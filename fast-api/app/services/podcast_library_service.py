from fastapi import BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError
from app.core.logging import get_logger
from app.core.ownership import require_source
from app.repositories.source_repository import SourceRepository
from app.schemas.podcasts import SourceDTO
from app.services.source_list_cache import invalidate_source_list_cache
from app.services.source_sectioning_service import queue_source_sectioning
from app.services.transcript_generator import get_transcript_generator

logger = get_logger(__name__)

_repo = SourceRepository()


class PodcastLibraryService:
    async def add_to_library(
        self,
        *,
        user_id: str,
        episode_id: int,
        db: AsyncSession,
        background_tasks: BackgroundTasks,
    ) -> SourceDTO:
        episode_row = await _repo.get_episode_for_library(db, episode_id)
        if episode_row is None:
            raise NotFoundError("episode", episode_id)

        existing_source_id = await _repo.get_source_id_for_episode(db, user_id, episode_id)
        if existing_source_id is None:
            source_id = await _repo.create_podcast_source(
                db,
                user_id=user_id,
                title=episode_row["title"] or episode_row["show_title"],
                author=episode_row["show_title"],
                published_at=episode_row["published_at"],
                episode_id=episode_id,
            )
        else:
            source_id = existing_source_id
            await _repo.update_podcast_source(
                db,
                source_id=source_id,
                user_id=user_id,
                author=episode_row["show_title"],
                published_at=episode_row["published_at"],
                episode_id=episode_id,
            )

        # Must commit (not flush) before scheduling background work: FastAPI runs
        # BackgroundTasks before get_db's teardown commit, and both the transcript
        # generator and the sectioning task open their own sessions that read this
        # new source row. Flushing would leave it uncommitted/locked for them.
        await db.commit()

        # The source list is cached per-user with a 30-min TTL; without this the
        # newly added episode keeps showing as "not in library" until the TTL
        # expires (the client refetches but gets the stale cached list).
        await invalidate_source_list_cache(user_id)

        try:
            generator = get_transcript_generator()
            await generator.generate_transcript(episode_id, db, background_tasks)
        except Exception as exc:
            logger.warning(
                "Failed to queue transcript generation for episode %s after add-to-library: %s",
                episode_id,
                exc,
                exc_info=True,
            )

        # If the episode was already transcribed (e.g. by another user), the
        # transcription pipeline early-returns and never fires sectioning for
        # this new source. Kick sectioning explicitly so the user gets sections
        # without having to wait for an admin backfill.
        try:
            source = await require_source(db, source_id, user_id)
            await queue_source_sectioning(
                db=db,
                background_tasks=background_tasks,
                source=source,
                skip_if_present=True,
            )
        except Exception as exc:
            logger.warning(
                "Failed to queue sectioning for source %s after add-to-library: %s",
                source_id,
                exc,
                exc_info=True,
            )

        detail = await _repo.get_source_detail(db, user_id, source_id)
        if detail is None:
            raise NotFoundError("source", source_id)
        return detail
