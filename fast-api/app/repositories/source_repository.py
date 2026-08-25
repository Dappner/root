from datetime import datetime
from typing import Any, Literal

from sqlalchemy import delete, func, select, text, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.datetime_utils import to_naive_utc, utcnow
from app.core.exceptions import AuthorizationError, NotFoundError
from app.models.database import PodcastEpisode, Source, SourceTag, Tag, Video
from app.schemas.sources import SourceDTO


async def bump_source_last_active(db: AsyncSession, source_id: int, user_id: str) -> None:
    """Mark a source as engaged. Call from any user-initiated mutation
    (capture/citation/takeaway create/update/delete) that represents
    real knowledge work. Do not call from playback ticks or detail views."""
    await db.execute(
        update(Source)
        .where(Source.id == source_id, Source.user_id == user_id)
        .values(last_active_at=func.now())
    )


# Shared SELECT/JOIN/GROUP-BY body for source detail rows. The detail query
# filters by id; the list query filters by user and orders by updated_at. Both
# hydrate episode (podcast) and video (video) fields so `_row_to_source_dto`
# can populate duration/image_url/media_url/source_url uniformly.
_SOURCE_SELECT_BODY = """
    SELECT
        s.id,
        s.title,
        s.type,
        s.status,
        s.metadata,
        s.summary_short,
        s.summary_long,
        s.last_active_at,
        s.completed_at,
        s.created_at,
        s.updated_at,
        s.label,
        s.author,
        s.published_at,
        s.episode_id,
        s.video_id,
        s.started_at,
        s.reflecting_at,
        COUNT(DISTINCT c.id)::INTEGER AS capture_count,
        COUNT(DISTINCT ci.id)::INTEGER AS citation_count,
        COUNT(DISTINCT st.id)::INTEGER AS takeaway_count,
        COALESCE(
            array_agg(DISTINCT stg.tag_id) FILTER (WHERE stg.tag_id IS NOT NULL),
            ARRAY[]::int[]
        )::int[] AS tag_ids,
        COALESCE(
            array_agg(DISTINCT cs.collection_id) FILTER (WHERE cs.collection_id IS NOT NULL),
            ARRAY[]::int[]
        )::int[] AS collection_ids,
        pe.title AS episode_title,
        pe.duration AS episode_duration,
        pe.image_url AS episode_image_url,
        pe.enclosure_url AS episode_enclosure_url,
        v.duration AS video_duration,
        v.thumbnail_url AS video_thumbnail_url,
        v.embed_url AS video_embed_url,
        v.platform AS video_platform,
        v.platform_id AS video_platform_id
    FROM sources s
    LEFT JOIN captures c ON s.id = c.source_id
    LEFT JOIN citations ci ON s.id = ci.source_id
    LEFT JOIN source_takeaways st ON s.id = st.source_id
    LEFT JOIN source_tags stg ON stg.source_id = s.id
    LEFT JOIN collection_sources cs ON cs.source_id = s.id
    LEFT JOIN podcast_episodes pe ON pe.id = s.episode_id
    LEFT JOIN videos v ON v.id = s.video_id
"""

_SOURCE_DETAIL_SQL = text(
    _SOURCE_SELECT_BODY
    + """
    WHERE s.id = :source_id
      AND s.user_id = :user_id
    GROUP BY s.id, pe.id, v.id
    """
)

_SOURCE_LIST_SQL = text(
    _SOURCE_SELECT_BODY
    + """
    WHERE s.user_id = :user_id
    GROUP BY s.id, pe.id, v.id
    ORDER BY s.updated_at DESC
    """
)

_FIND_BY_TITLE_AND_TYPE_SQL = text("""
    SELECT id FROM sources
    WHERE user_id = :user_id
      AND LOWER(TRIM(title)) = LOWER(:title)
      AND type = :type
    LIMIT 1
    """)

_DELETE_EMBEDDINGS_FOR_SOURCE_SQL = text("""
    DELETE FROM rag_embeddings
    WHERE citation_id IN (SELECT id FROM citations        WHERE citations.source_id        = :sid)
       OR capture_id  IN (SELECT id FROM captures         WHERE captures.source_id         = :sid)
       OR takeaway_id IN (SELECT id FROM source_takeaways WHERE source_takeaways.source_id = :sid)
       OR section_id  IN (SELECT id FROM source_sections  WHERE source_sections.source_id  = :sid)
       OR rag_embeddings.source_id = :sid
    """)


def _row_to_source_dto(row: dict[str, Any]) -> SourceDTO:
    """Build a SourceDTO from a `_SOURCE_SELECT_BODY` row.

    Podcast sources pull duration/image/media from the joined episode; video
    sources pull them from the joined video and derive a canonical YouTube
    watch URL.
    """
    duration = row["episode_duration"]
    image_url = row["episode_image_url"]
    media_url = row["episode_enclosure_url"]
    episode = row["episode_title"]
    source_url: str | None = None

    if row["type"] == "video":
        duration = row["video_duration"]
        image_url = row["video_thumbnail_url"]
        media_url = row["video_embed_url"]
        if row["video_platform"] == "youtube" and row["video_platform_id"]:
            source_url = f"https://www.youtube.com/watch?v={row['video_platform_id']}"

    return SourceDTO(
        id=row["id"],
        title=row["title"],
        type=row["type"],
        status=row["status"],
        metadata=row["metadata"],
        summary_short=row["summary_short"],
        summary_long=row["summary_long"],
        tag_ids=list(row["tag_ids"] or []),
        collection_ids=list(row["collection_ids"] or []),
        capture_count=row["capture_count"],
        citation_count=row["citation_count"],
        takeaway_count=row["takeaway_count"],
        published_at=row["published_at"],
        last_active_at=row["last_active_at"],
        started_at=row["started_at"],
        reflecting_at=row["reflecting_at"],
        completed_at=row["completed_at"],
        episode_id=row["episode_id"],
        video_id=row["video_id"],
        duration=duration,
        episode=episode,
        image_url=image_url,
        media_url=media_url,
        source_url=source_url,
        label=row["label"],
        author=row["author"],
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )


_EPISODE_FOR_LIBRARY_SQL = text("""
    SELECT
        pe.id,
        pe.title,
        pe.duration,
        pe.enclosure_url,
        pe.image_url,
        pe.published_at,
        ps.title AS show_title
    FROM podcast_episodes pe
    JOIN shows ps ON ps.id = pe.show_id
    WHERE pe.id = :episode_id
    """)

_SOURCE_FOR_EPISODE_SQL = text("""
    SELECT id FROM sources
    WHERE user_id = :user_id AND episode_id = :episode_id
    LIMIT 1
    """)

_INSERT_SOURCE_SQL = text("""
    INSERT INTO sources (
        user_id, title, type, status, metadata, author, published_at, episode_id
    )
    VALUES (
        :user_id, :title, 'podcast', 'todo', '{}'::jsonb,
        :author, :published_at, :episode_id
    )
    RETURNING id
    """)

_UPDATE_SOURCE_EPISODE_SQL = text("""
    UPDATE sources
    SET author = :author,
        published_at = :published_at,
        episode_id = :episode_id,
        updated_at = NOW()
    WHERE id = :source_id
      AND user_id = :user_id
    """)

TranscriptStatus = Literal["none", "pending", "transcribed", "embedded", "failed"]


class SourceRepository:
    # --- Episode queries ---

    async def get_episode(self, db: AsyncSession, episode_id: int) -> PodcastEpisode | None:
        result = await db.execute(select(PodcastEpisode).where(PodcastEpisode.id == episode_id))
        return result.scalar_one_or_none()

    async def list_transcribed_episode_ids(self, db: AsyncSession) -> list[int]:
        """Ids of every episode whose transcript is ready (transcribed or
        embedded) — the candidate set for section backfill."""
        result = await db.execute(
            select(PodcastEpisode.id).where(
                PodcastEpisode.transcript_status.in_(("transcribed", "embedded"))
            )
        )
        return [int(row[0]) for row in result.all()]

    async def list_transcribed_episode_rows(
        self, db: AsyncSession
    ) -> list[tuple[int, str, int, str, str]]:
        """One row per episode with a finished ('transcribed') transcript:
        `(source_id, source_title, episode_id, episode_title, transcript_status)`.
        DISTINCT ON episode dedupes multiple sources pointing at the same episode.
        Admin embed-queue view."""
        result = await db.execute(
            select(
                Source.id,
                Source.title,
                PodcastEpisode.id,
                PodcastEpisode.title,
                PodcastEpisode.transcript_status,
            )
            .join(PodcastEpisode, Source.episode_id == PodcastEpisode.id)
            .where(
                Source.type == "podcast",
                PodcastEpisode.transcript_status == "transcribed",
            )
            .distinct(PodcastEpisode.id)
            .order_by(PodcastEpisode.id, Source.id)
        )
        return [(r[0], r[1], r[2], r[3], r[4]) for r in result.all()]

    async def get_episode_locked(self, db: AsyncSession, episode_id: int) -> PodcastEpisode | None:
        result = await db.execute(
            select(PodcastEpisode).where(PodcastEpisode.id == episode_id).with_for_update()
        )
        return result.scalar_one_or_none()

    async def get_source_for_episode(self, db: AsyncSession, episode_id: int) -> Source | None:
        result = await db.execute(select(Source).where(Source.episode_id == episode_id))
        return result.scalars().first()

    async def list_sources_for_episode(self, db: AsyncSession, episode_id: int) -> list[Source]:
        """Return every user-owned source pointing at this episode.

        Transcripts are shared across users (one R2 object per episode), but each
        user has their own source row. Use this when a side-effect of transcript
        generation needs to land on every user who imported the episode.
        """
        result = await db.execute(select(Source).where(Source.episode_id == episode_id))
        return list(result.scalars().all())

    async def update_episode_status(
        self,
        db: AsyncSession,
        episode_id: int,
        status: TranscriptStatus,
        source: str | None = None,
        error: str | None = None,
        r2_audio_key: str | None = None,
    ) -> None:
        episode = await self.get_episode(db, episode_id)
        if not episode:
            raise NotFoundError("episode", episode_id)
        episode.transcript_status = status
        episode.transcript_source = source
        episode.transcript_error = error
        if r2_audio_key is not None:
            episode.r2_audio_key = r2_audio_key
        await db.flush()

    # --- Video queries ---

    async def get_video(self, db: AsyncSession, video_id: int) -> Video | None:
        result = await db.execute(select(Video).where(Video.id == video_id))
        return result.scalar_one_or_none()

    async def get_video_locked(self, db: AsyncSession, video_id: int) -> Video | None:
        result = await db.execute(select(Video).where(Video.id == video_id).with_for_update())
        return result.scalar_one_or_none()

    async def get_source_for_video(self, db: AsyncSession, video_id: int) -> Source | None:
        result = await db.execute(select(Source).where(Source.video_id == video_id))
        return result.scalars().first()

    async def list_sources_for_video(self, db: AsyncSession, video_id: int) -> list[Source]:
        """Return every user-owned source pointing at this video.

        Same rationale as `list_sources_for_episode`: transcripts are shared per
        video; section side-effects should fan out to all linked sources.
        """
        result = await db.execute(select(Source).where(Source.video_id == video_id))
        return list(result.scalars().all())

    async def update_video_status(
        self,
        db: AsyncSession,
        video_id: int,
        status: TranscriptStatus,
        source: str | None = None,
        error: str | None = None,
    ) -> None:
        video = await self.get_video(db, video_id)
        if not video:
            raise NotFoundError("video", video_id)
        video.transcript_status = status
        video.transcript_source = source
        video.transcript_error = error
        await db.flush()

    # --- Podcast library ---

    async def get_episode_for_library(self, db: AsyncSession, episode_id: int) -> dict | None:
        result = await db.execute(_EPISODE_FOR_LIBRARY_SQL, {"episode_id": episode_id})
        row = result.mappings().one_or_none()
        return dict(row) if row else None

    async def get_source_id_for_episode(
        self, db: AsyncSession, user_id: str, episode_id: int
    ) -> int | None:
        result = await db.execute(
            _SOURCE_FOR_EPISODE_SQL, {"user_id": user_id, "episode_id": episode_id}
        )
        row = result.mappings().one_or_none()
        return int(row["id"]) if row else None

    async def create_podcast_source(
        self,
        db: AsyncSession,
        user_id: str,
        title: str,
        author: str | None,
        published_at: object,
        episode_id: int,
    ) -> int:
        result = await db.execute(
            _INSERT_SOURCE_SQL,
            {
                "user_id": user_id,
                "title": title,
                "author": author,
                "published_at": published_at,
                "episode_id": episode_id,
            },
        )
        return int(result.mappings().one()["id"])

    async def update_podcast_source(
        self,
        db: AsyncSession,
        source_id: int,
        user_id: str,
        author: str | None,
        published_at: object,
        episode_id: int,
    ) -> None:
        await db.execute(
            _UPDATE_SOURCE_EPISODE_SQL,
            {
                "source_id": source_id,
                "user_id": user_id,
                "author": author,
                "published_at": published_at,
                "episode_id": episode_id,
            },
        )

    async def get_source_detail(
        self, db: AsyncSession, user_id: str, source_id: int
    ) -> SourceDTO | None:
        result = await db.execute(_SOURCE_DETAIL_SQL, {"source_id": source_id, "user_id": user_id})
        row = result.mappings().one_or_none()
        if row is None:
            return None
        return _row_to_source_dto(dict(row))

    async def get_image_url_for_source(
        self, db: AsyncSession, *, episode_id: int | None, video_id: int | None
    ) -> str | None:
        """Resolve a source's display image: the podcast episode image when the
        source is episode-backed, the video thumbnail when video-backed, else
        None. Matches the per-source single-takeaway read paths."""
        if episode_id is not None:
            result = await db.execute(
                select(PodcastEpisode.image_url).where(PodcastEpisode.id == episode_id)
            )
            return result.scalar_one_or_none()
        if video_id is not None:
            result = await db.execute(select(Video.thumbnail_url).where(Video.id == video_id))
            return result.scalar_one_or_none()
        return None

    async def get_for_user(self, db: AsyncSession, source_id: int, user_id: str) -> Source | None:
        """Plain ORM fetch of a source scoped to its owner, or None."""
        result = await db.execute(
            select(Source).where(Source.id == source_id, Source.user_id == user_id)
        )
        return result.scalar_one_or_none()

    async def list_for_user(
        self, db: AsyncSession, user_id: str, limit: int | None = None
    ) -> list[Source]:
        """Plain ORM list of a user's sources. For hydrated DTO rows use
        `list_source_details` instead."""
        stmt = select(Source).where(Source.user_id == user_id)
        if limit is not None:
            stmt = stmt.limit(limit)
        result = await db.execute(stmt)
        return list(result.scalars().all())

    async def set_video_id(self, db: AsyncSession, source_id: int, video_id: int) -> None:
        """Link a source to a video."""
        await db.execute(update(Source).where(Source.id == source_id).values(video_id=video_id))

    # --- Source CRUD ---

    async def list_source_details(self, db: AsyncSession, user_id: str) -> list[SourceDTO]:
        """All sources for a user, newest-updated first. Episode/video hydration
        is done in a single joined query."""
        result = await db.execute(_SOURCE_LIST_SQL, {"user_id": user_id})
        return [_row_to_source_dto(dict(row)) for row in result.mappings().all()]

    async def find_by_title_and_type(
        self, db: AsyncSession, user_id: str, title: str, type: str
    ) -> int | None:
        """Case-insensitive trimmed title + exact type match (duplicate check)."""
        result = await db.execute(
            _FIND_BY_TITLE_AND_TYPE_SQL,
            {"user_id": user_id, "title": title, "type": type},
        )
        row = result.mappings().one_or_none()
        return int(row["id"]) if row else None

    async def create_source(
        self,
        db: AsyncSession,
        user_id: str,
        *,
        title: str,
        type: str,
        status: str,
        metadata: dict,
        label: str | None,
        author: str | None,
        published_at: datetime | None,
    ) -> int:
        """Insert a source and return its id (flushed, not committed)."""
        now = utcnow()
        source = Source(
            user_id=user_id,
            title=title,
            type=type,
            status=status,
            metadata_json=metadata,
            label=label,
            author=author,
            published_at=to_naive_utc(published_at),
            created_at=now,
            updated_at=now,
        )
        db.add(source)
        await db.flush()
        return source.id

    async def delete_source(self, db: AsyncSession, source_id: int, user_id: str) -> None:
        """Delete a source row. Child rows are handled by DB FK behavior (the
        schema's ON DELETE rules)."""
        await db.execute(delete(Source).where(Source.id == source_id, Source.user_id == user_id))

    async def find_source_by_video_id(
        self, db: AsyncSession, user_id: str, video_id: int
    ) -> Source | None:
        """User-scoped lookup of the source linked to a video (used by video
        import to decide create-vs-update)."""
        result = await db.execute(
            select(Source).where(Source.video_id == video_id, Source.user_id == user_id)
        )
        return result.scalars().first()

    async def set_tags_for_source(
        self, db: AsyncSession, user_id: str, source_id: int, tag_ids: list[int]
    ) -> None:
        """Replace the tag set for a source (delete-all + insert).

        Verifies the caller owns every incoming tag via a count check; an
        unowned tag raises AuthorizationError (-> 403).
        """
        unique_ids = list(dict.fromkeys(tag_ids))

        if unique_ids:
            owned = (
                await db.execute(
                    select(func.count())
                    .select_from(Tag)
                    .where(Tag.user_id == user_id, Tag.id.in_(unique_ids))
                )
            ).scalar_one()
            if owned != len(unique_ids):
                raise AuthorizationError(f"source {source_id} tags not accessible")

        await db.execute(delete(SourceTag).where(SourceTag.source_id == source_id))

        if unique_ids:
            now = utcnow()
            db.add_all(
                [
                    SourceTag(source_id=source_id, tag_id=tag_id, created_at=now)
                    for tag_id in unique_ids
                ]
            )
        await db.flush()

    async def delete_embeddings_for_source(self, db: AsyncSession, source_id: int) -> None:
        """Delete every embedding belonging to a source — its citations,
        captures, takeaways, sections, and any source-level chunks."""
        await db.execute(_DELETE_EMBEDDINGS_FOR_SOURCE_SQL, {"sid": source_id})
