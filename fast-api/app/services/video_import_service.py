"""Video import + add-to-library.

- `import_youtube_video` resolves a URL/ID, short-circuits on an already-imported
  video, otherwise fetches metadata from the YouTube Data API, imports the channel
  (tolerating channel failures), and upserts the video.
- `add_to_library` creates or refreshes the user's `video` source row pointing at
  an imported video and returns the hydrated `SourceDTO`.

Both methods take `db` and never commit — the route's `get_db` dependency owns the
transaction boundary (see fast-api/AGENTS.md "Transaction ownership").
"""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.datetime_utils import utcnow
from app.core.exceptions import ExternalServiceError, NotFoundError
from app.core.logging import get_logger
from app.integrations.youtube_data import YouTubeDataClient, extract_video_id
from app.models.database import Channel, Video
from app.repositories.source_repository import SourceRepository
from app.repositories.video_repository import VideoRepository
from app.schemas.sources import SourceDTO
from app.schemas.videos import VideoDTO
from app.services.source_list_cache import invalidate_source_list_cache

logger = get_logger(__name__)

_PLATFORM_YOUTUBE = "youtube"


class VideoImportService:
    def __init__(
        self,
        *,
        youtube: YouTubeDataClient | None = None,
        video_repo: VideoRepository | None = None,
        source_repo: SourceRepository | None = None,
    ) -> None:
        self._youtube = youtube or YouTubeDataClient(settings.google_api_key)
        self._videos = video_repo or VideoRepository()
        self._sources = source_repo or SourceRepository()

    async def import_youtube_video(self, db: AsyncSession, url_or_id: str) -> VideoDTO:
        """Import a YouTube video by URL or ID; return the (possibly existing) video.

        Raises `ExternalServiceError` for an unresolvable URL or a YouTube API
        failure (video not found included)."""
        video_id = extract_video_id(url_or_id)

        existing = await self._videos.get_video_by_platform_id(
            db, platform=_PLATFORM_YOUTUBE, platform_id=video_id
        )
        if existing is not None:
            logger.info("video already exists: %s (id=%s)", video_id, existing.id)
            return VideoDTO.model_validate(existing)

        video_result = await self._youtube.get_video(video_id)

        channel = await self._import_channel(db, video_result.channel_id)

        embed_url = f"https://www.youtube.com/embed/{video_id}"
        upserted = await self._videos.upsert_video(
            db,
            platform=_PLATFORM_YOUTUBE,
            platform_id=video_id,
            title=video_result.title,
            channel_id=channel.id if channel is not None else None,
            description=video_result.description or None,
            thumbnail_url=video_result.thumbnail_url or None,
            duration=video_result.duration,
            view_count=video_result.view_count,
            embed_url=embed_url,
            transcript_status="none",
            published_at=video_result.published_at,
        )
        logger.info("imported YouTube video: %s (id=%s)", video_id, upserted.id)
        return VideoDTO.model_validate(upserted)

    async def _import_channel(self, db: AsyncSession, channel_id: str) -> Channel | None:
        """Import or return an existing channel. Channel failures are tolerated:
        a missing channel id or a YouTube error is logged and the video import
        continues without a channel link."""
        if not channel_id:
            return None

        existing = await self._videos.get_channel_by_platform_id(
            db, platform=_PLATFORM_YOUTUBE, platform_id=channel_id
        )
        if existing is not None:
            return existing

        try:
            channel_result = await self._youtube.get_channel(channel_id)
        except ExternalServiceError as exc:
            logger.warning(
                "failed to import channel %s, continuing without link: %s",
                channel_id,
                exc,
            )
            return None

        channel = await self._videos.upsert_channel(
            db,
            platform=_PLATFORM_YOUTUBE,
            platform_id=channel_id,
            name=channel_result.title,
            description=channel_result.description or None,
            thumbnail_url=channel_result.thumbnail_url or None,
            subscriber_count=channel_result.subscriber_count,
            video_count=channel_result.video_count,
            custom_url=channel_result.custom_url or None,
        )
        logger.info("imported YouTube channel: %s (id=%s)", channel_id, channel.id)
        return channel

    async def add_to_library(
        self, db: AsyncSession, user_id: str, video_id: int
    ) -> tuple[SourceDTO, bool]:
        """Create or refresh the user's `video` source for an imported video.

        Returns the hydrated `SourceDTO` and a `should_ingest` flag telling the
        caller whether to kick off transcript generation: true for a fresh add,
        and for a re-add (which clears embeddings and so must re-ingest). Raises
        `NotFoundError` if the video does not exist.

        Does not start ingestion itself — that schedules a background task and
        commits, which the route owns (see fast-api/AGENTS.md "Transaction
        ownership")."""
        video = await self._videos.get_video(db, video_id=video_id)
        if video is None:
            raise NotFoundError("video", video_id)

        author = await self._resolve_author(db, video)

        existing = await self._sources.find_source_by_video_id(db, user_id, video_id)
        if existing is not None:
            source_id = existing.id
            existing.published_at = video.published_at
            if author:
                existing.author = author
            existing.video_id = video_id
            existing.updated_at = utcnow()
            await db.flush()
            await self._sources.delete_embeddings_for_source(db, source_id)
        else:
            source_id = await self._sources.create_source(
                db,
                user_id,
                title=video.title,
                type="video",
                status="todo",
                metadata={},
                label=None,
                author=author or None,
                published_at=video.published_at,
            )
            await self._sources.set_video_id(db, source_id, video_id)
            await db.flush()

        detail = await self._sources.get_source_detail(db, user_id, source_id)
        if detail is None:
            raise NotFoundError("source", source_id)
        # Bust the per-user source-list cache so the newly added video shows as
        # in-library immediately instead of after the 30-min TTL (matches the
        # invalidation every other source mutation in source_service performs).
        await invalidate_source_list_cache(user_id)
        return detail, True

    async def _resolve_author(self, db: AsyncSession, video: Video) -> str:
        if video.channel_id is None:
            return ""
        channel = await self._videos.get_channel(db, channel_id=video.channel_id)
        return channel.name if channel is not None else ""
