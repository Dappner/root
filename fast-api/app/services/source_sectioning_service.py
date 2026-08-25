"""Per-source section regeneration.

Wraps the episode-level TranscriptSectioningService to expose a single-source
entry point. Used by the add-to-library flow (to fix the case where a user
adds a podcast whose episode was already transcribed by someone else and so
the per-episode pipeline never fires sectioning for the new source) and by
the manual "regenerate sections" button.
"""

from __future__ import annotations

from typing import Awaitable, Callable, Literal

from fastapi import BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ValidationError
from app.core.logging import get_logger
from app.core.ownership import require_source
from app.models.database import Source
from app.repositories.source_section_repository import SourceSectionRepository
from app.services.transcript_generator import get_transcript_generator
from app.services.transcript_sectioning_service import TranscriptSectioningService
from app.services.video_transcript_generator import get_video_transcript_generator

logger = get_logger(__name__)

RegenerateStatus = Literal["queued", "skipped", "no_transcript"]

_READY_TRANSCRIPT_STATUSES = ("transcribed", "embedded")


async def has_auto_sections(db: AsyncSession, source_id: int) -> bool:
    return await SourceSectionRepository().has_auto_sections(db, source_id)


async def queue_source_sectioning(
    *,
    db: AsyncSession,
    background_tasks: BackgroundTasks,
    source: Source,
    skip_if_present: bool,
) -> tuple[RegenerateStatus, str | None]:
    """Queue sectioning for a single source, returning a (status, reason) pair.

    `skip_if_present=True` is for the silent auto-fire path (add-to-library):
    if the source already has auto sections, don't redo work. The manual
    button passes False to force a regenerate.

    Transcript readiness is checked synchronously here so callers get
    "no_transcript" up front rather than a misleading "queued" for a task
    that will immediately bail in the background.
    """
    if source.episode_id is None and source.video_id is None:
        return "skipped", "source is not audio/video"

    if skip_if_present and await has_auto_sections(db, source.id):
        return "skipped", "sections already generated"

    if source.episode_id is not None:
        generator = get_transcript_generator()
        sectioning_service = generator.sectioning_service
        if sectioning_service is None:
            return "skipped", "sectioning service unavailable"

        episode = await generator._repo.get_episode(db, source.episode_id)
        if not episode:
            return "no_transcript", "Episode not found."
        if episode.transcript_status not in _READY_TRANSCRIPT_STATUSES:
            return "no_transcript", _readiness_reason(episode.transcript_status)

        _enqueue_sectioning(
            background_tasks=background_tasks,
            kind="episode",
            source_id=source.id,
            content_id=source.episode_id,
            fetch_transcript=_make_fetcher(generator.get_transcript_content, source.episode_id),
            session_factory=generator.session_factory,
            sectioning_service=sectioning_service,
        )
        return "queued", None

    video_id = source.video_id
    assert video_id is not None
    video_generator = get_video_transcript_generator()
    sectioning_service = video_generator.sectioning_service
    if sectioning_service is None:
        return "skipped", "sectioning service unavailable"

    video = await video_generator._repo.get_video(db, video_id)
    if not video:
        return "no_transcript", "Video not found."
    if video.transcript_status not in _READY_TRANSCRIPT_STATUSES:
        return "no_transcript", _readiness_reason(video.transcript_status)

    _enqueue_sectioning(
        background_tasks=background_tasks,
        kind="video",
        source_id=source.id,
        content_id=video_id,
        fetch_transcript=_make_fetcher(video_generator.get_transcript_content, video_id),
        session_factory=video_generator.session_factory,
        sectioning_service=sectioning_service,
    )
    return "queued", None


def _make_fetcher(
    get_transcript: Callable[[int, AsyncSession], Awaitable[dict]],
    content_id: int,
) -> Callable[[AsyncSession], Awaitable[dict]]:
    async def fetch(bg_db: AsyncSession) -> dict:
        return await get_transcript(content_id, bg_db)

    return fetch


def _readiness_reason(status: str | None) -> str:
    if status == "pending":
        return "Transcript generation in progress. Please check back in a few minutes."
    if status == "failed":
        return "Transcript generation failed. Please try generating again."
    if status == "none" or status is None:
        return "No transcript has been generated yet. Please generate one first."
    return f"Transcript not ready. Current status: {status}"


def _enqueue_sectioning(
    *,
    background_tasks: BackgroundTasks,
    kind: Literal["episode", "video"],
    source_id: int,
    content_id: int,
    fetch_transcript: Callable[[AsyncSession], Awaitable[dict]],
    session_factory: Callable[[], object],
    sectioning_service: TranscriptSectioningService,
) -> None:
    async def _run() -> None:
        try:
            async with session_factory() as bg_db:  # type: ignore[attr-defined]
                transcript_data = await fetch_transcript(bg_db)
            await sectioning_service.generate([source_id], transcript_data.get("utterances") or [])
        except ValidationError as exc:
            # Race: transcript was ready when we checked but became unavailable
            # before the background task ran. Rare; just log.
            logger.info(
                "Skipping sectioning for source %s (%s %s): %s",
                source_id,
                kind,
                content_id,
                exc,
            )
        except Exception as exc:
            logger.warning(
                "Sectioning failed for source %s (%s %s): %s",
                source_id,
                kind,
                content_id,
                exc,
                exc_info=True,
            )

    background_tasks.add_task(_run)


async def regenerate_sections_for_source(
    *,
    db: AsyncSession,
    background_tasks: BackgroundTasks,
    source_id: int,
    user_id: str,
) -> tuple[RegenerateStatus, str | None]:
    """Manual entry point: ownership-check then queue."""
    source = await require_source(db, source_id, user_id)
    return await queue_source_sectioning(
        db=db,
        background_tasks=background_tasks,
        source=source,
        skip_if_present=False,
    )
