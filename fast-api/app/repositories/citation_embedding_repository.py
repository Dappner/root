from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import delete, text
from sqlalchemy.engine import RowMapping
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.database import RagEmbedding
from app.repositories._rag_embedding_upsert import upsert_rag_embedding

_GET_CITATION_CANDIDATE_SQL = text("""
    SELECT
        c.id,
        c.text,
        c.speaker,
        c.context,
        c.text_sha256,
        s.title AS source_title,
        s.type AS source_type,
        s.author AS source_author,
        s.published_at AS source_published_at,
        pe.title AS podcast_episode_title,
        pe.duration AS podcast_duration,
        pe.published_at AS podcast_published_at,
        sh.title AS podcast_show_title,
        sh.author AS podcast_show_author,
        v.title AS video_title,
        v.platform AS video_platform,
        v.duration AS video_duration,
        v.published_at AS video_published_at,
        ch.name AS video_channel_name
    FROM citations c
    LEFT JOIN sources s ON s.id = c.source_id
    LEFT JOIN podcast_episodes pe ON pe.id = s.episode_id
    LEFT JOIN shows sh ON sh.id = pe.show_id
    LEFT JOIN videos v ON v.id = s.video_id
    LEFT JOIN channels ch ON ch.id = v.channel_id
    WHERE c.id = :citation_id AND c.user_id = :user_id
    """)

_GET_CAPTURE_CANDIDATE_SQL = text("""
    SELECT
        cap.id,
        cap.content,
        cap.content_sha256,
        c.text AS citation_text,
        c.speaker AS citation_speaker,
        c.context AS citation_context,
        s.title AS source_title,
        s.type AS source_type,
        s.author AS source_author,
        s.published_at AS source_published_at,
        pe.title AS podcast_episode_title,
        pe.duration AS podcast_duration,
        pe.published_at AS podcast_published_at,
        sh.title AS podcast_show_title,
        sh.author AS podcast_show_author,
        v.title AS video_title,
        v.platform AS video_platform,
        v.duration AS video_duration,
        v.published_at AS video_published_at,
        ch.name AS video_channel_name
    FROM captures cap
    LEFT JOIN citations c ON c.id = cap.citation_id
    LEFT JOIN sources s ON s.id = cap.source_id
    LEFT JOIN podcast_episodes pe ON pe.id = s.episode_id
    LEFT JOIN shows sh ON sh.id = pe.show_id
    LEFT JOIN videos v ON v.id = s.video_id
    LEFT JOIN channels ch ON ch.id = v.channel_id
    WHERE cap.id = :capture_id AND cap.user_id = :user_id
    """)

# `:user_id` NULL scans all users; a specific id scopes the admin refresh.
# Rows without text_sha256 are skipped — they get a hash on next mutation and
# re-enter the pool naturally.
_FIND_STALE_CITATION_CANDIDATES_SQL = text("""
    SELECT
        c.id,
        c.user_id,
        c.text,
        c.speaker,
        c.context,
        c.text_sha256,
        s.title AS source_title,
        s.type AS source_type,
        s.author AS source_author,
        s.published_at AS source_published_at,
        pe.title AS podcast_episode_title,
        pe.duration AS podcast_duration,
        pe.published_at AS podcast_published_at,
        sh.title AS podcast_show_title,
        sh.author AS podcast_show_author,
        v.title AS video_title,
        v.platform AS video_platform,
        v.duration AS video_duration,
        v.published_at AS video_published_at,
        ch.name AS video_channel_name
    FROM citations c
    LEFT JOIN sources s ON s.id = c.source_id
    LEFT JOIN podcast_episodes pe ON pe.id = s.episode_id
    LEFT JOIN shows sh ON sh.id = pe.show_id
    LEFT JOIN videos v ON v.id = s.video_id
    LEFT JOIN channels ch ON ch.id = v.channel_id
    LEFT JOIN rag_embeddings e ON e.citation_id = c.id
    WHERE c.text_sha256 IS NOT NULL
      AND (CAST(:user_id AS TEXT) IS NULL OR c.user_id = CAST(:user_id AS TEXT))
      AND (
        e.citation_id IS NULL
        OR e.model IS DISTINCT FROM :model
        OR e.content_sha256 IS DISTINCT FROM c.text_sha256
      )
    ORDER BY c.created_at DESC
    LIMIT :limit
    """)

_FIND_STALE_CAPTURE_CANDIDATES_SQL = text("""
    SELECT
        cap.id,
        cap.user_id,
        cap.content,
        cap.content_sha256,
        c.text AS citation_text,
        c.speaker AS citation_speaker,
        c.context AS citation_context,
        s.title AS source_title,
        s.type AS source_type,
        s.author AS source_author,
        s.published_at AS source_published_at,
        pe.title AS podcast_episode_title,
        pe.duration AS podcast_duration,
        pe.published_at AS podcast_published_at,
        sh.title AS podcast_show_title,
        sh.author AS podcast_show_author,
        v.title AS video_title,
        v.platform AS video_platform,
        v.duration AS video_duration,
        v.published_at AS video_published_at,
        ch.name AS video_channel_name
    FROM captures cap
    LEFT JOIN citations c ON c.id = cap.citation_id
    LEFT JOIN sources s ON s.id = cap.source_id
    LEFT JOIN podcast_episodes pe ON pe.id = s.episode_id
    LEFT JOIN shows sh ON sh.id = pe.show_id
    LEFT JOIN videos v ON v.id = s.video_id
    LEFT JOIN channels ch ON ch.id = v.channel_id
    LEFT JOIN rag_embeddings e ON e.capture_id = cap.id
    WHERE cap.content_sha256 IS NOT NULL
      AND cap.deleted_at IS NULL
      AND (CAST(:user_id AS TEXT) IS NULL OR cap.user_id = CAST(:user_id AS TEXT))
      AND (
        e.capture_id IS NULL
        OR e.model IS DISTINCT FROM :model
        OR e.content_sha256 IS DISTINCT FROM cap.content_sha256
      )
    ORDER BY cap.created_at DESC
    LIMIT :limit
    """)

# Count-only variants for the admin "stale count" endpoint. Same predicate as
# the find queries, but aggregated server-side so a single round-trip yields
# the totals shown in the admin card.
_COUNT_STALE_CITATIONS_SQL = text("""
    SELECT COUNT(*)
    FROM citations c
    LEFT JOIN rag_embeddings e ON e.citation_id = c.id
    WHERE c.text_sha256 IS NOT NULL
      AND (CAST(:user_id AS TEXT) IS NULL OR c.user_id = CAST(:user_id AS TEXT))
      AND (
        e.citation_id IS NULL
        OR e.model IS DISTINCT FROM :model
        OR e.content_sha256 IS DISTINCT FROM c.text_sha256
      )
    """)

_COUNT_STALE_CAPTURES_SQL = text("""
    SELECT COUNT(*)
    FROM captures cap
    LEFT JOIN rag_embeddings e ON e.capture_id = cap.id
    WHERE cap.content_sha256 IS NOT NULL
      AND cap.deleted_at IS NULL
      AND (CAST(:user_id AS TEXT) IS NULL OR cap.user_id = CAST(:user_id AS TEXT))
      AND (
        e.capture_id IS NULL
        OR e.model IS DISTINCT FROM :model
        OR e.content_sha256 IS DISTINCT FROM cap.content_sha256
      )
    """)


@dataclass(frozen=True)
class SourceEmbeddingContext:
    # TODO(embedding-staleness): every field here is interpolated into the
    # embedded document, but stale detection only compares the *entity*
    # content hash. Editing the source title (or author, podcast metadata,
    # etc.) changes the doc but not the entity sha, so the embedding goes
    # silently stale until the next entity-content edit or admin refresh.
    # `status` and `label` were dropped from this struct because status
    # mutates on every source lifecycle transition — keeping it would mean
    # ~100% staleness in practice. The remaining fields mutate rarely.
    # Long-term fix: store a hash of the rendered document on rag_embeddings
    # and compare against that instead of (or in addition to) the entity
    # sha. Then a title rename naturally invalidates and re-embeds.
    title: str | None
    type: str | None
    author: str | None
    published_at: datetime | None
    podcast_episode_title: str | None
    podcast_duration: int | None
    podcast_published_at: datetime | None
    podcast_show_title: str | None
    podcast_show_author: str | None
    video_title: str | None
    video_platform: str | None
    video_duration: int | None
    video_published_at: datetime | None
    video_channel_name: str | None


@dataclass(frozen=True)
class CitationEmbeddingCandidate:
    id: int
    text: str | None
    speaker: str | None
    context: str | None
    content_sha256: str | None
    source: SourceEmbeddingContext


@dataclass(frozen=True)
class CaptureEmbeddingCandidate:
    id: int
    content: str | None
    content_sha256: str | None
    citation_text: str | None
    citation_speaker: str | None
    citation_context: str | None
    source: SourceEmbeddingContext


def _source_context(row: RowMapping) -> SourceEmbeddingContext:
    return SourceEmbeddingContext(
        title=row["source_title"],
        type=row["source_type"],
        author=row["source_author"],
        published_at=row["source_published_at"],
        podcast_episode_title=row["podcast_episode_title"],
        podcast_duration=row["podcast_duration"],
        podcast_published_at=row["podcast_published_at"],
        podcast_show_title=row["podcast_show_title"],
        podcast_show_author=row["podcast_show_author"],
        video_title=row["video_title"],
        video_platform=row["video_platform"],
        video_duration=row["video_duration"],
        video_published_at=row["video_published_at"],
        video_channel_name=row["video_channel_name"],
    )


def _citation_candidate(row: RowMapping) -> CitationEmbeddingCandidate:
    return CitationEmbeddingCandidate(
        id=row["id"],
        text=row["text"],
        speaker=row["speaker"],
        context=row["context"],
        content_sha256=row["text_sha256"],
        source=_source_context(row),
    )


def _capture_candidate(row: RowMapping) -> CaptureEmbeddingCandidate:
    return CaptureEmbeddingCandidate(
        id=row["id"],
        content=row["content"],
        content_sha256=row["content_sha256"],
        citation_text=row["citation_text"],
        citation_speaker=row["citation_speaker"],
        citation_context=row["citation_context"],
        source=_source_context(row),
    )


class CitationEmbeddingRepository:
    async def get_citation_candidate(
        self, db: AsyncSession, *, citation_id: int, user_id: str
    ) -> CitationEmbeddingCandidate | None:
        result = await db.execute(
            _GET_CITATION_CANDIDATE_SQL,
            {"citation_id": citation_id, "user_id": user_id},
        )
        row = result.mappings().one_or_none()
        return _citation_candidate(row) if row is not None else None

    async def get_capture_candidate(
        self, db: AsyncSession, *, capture_id: int, user_id: str
    ) -> CaptureEmbeddingCandidate | None:
        result = await db.execute(
            _GET_CAPTURE_CANDIDATE_SQL,
            {"capture_id": capture_id, "user_id": user_id},
        )
        row = result.mappings().one_or_none()
        return _capture_candidate(row) if row is not None else None

    async def upsert_citation_embedding(
        self,
        db: AsyncSession,
        *,
        citation_id: int,
        content_sha256: str,
        embedding: Sequence[float],
        model: str,
        created_at: datetime,
    ) -> None:
        await upsert_rag_embedding(
            db,
            fk_column="citation_id",
            entity_id=citation_id,
            content_sha256=content_sha256,
            embedding=embedding,
            model=model,
            created_at=created_at,
        )

    async def upsert_capture_embedding(
        self,
        db: AsyncSession,
        *,
        capture_id: int,
        content_sha256: str,
        embedding: Sequence[float],
        model: str,
        created_at: datetime,
    ) -> None:
        await upsert_rag_embedding(
            db,
            fk_column="capture_id",
            entity_id=capture_id,
            content_sha256=content_sha256,
            embedding=embedding,
            model=model,
            created_at=created_at,
        )

    async def delete_citation_embedding(self, db: AsyncSession, citation_id: int) -> None:
        await db.execute(delete(RagEmbedding).where(RagEmbedding.citation_id == citation_id))

    async def delete_capture_embedding(self, db: AsyncSession, capture_id: int) -> None:
        await db.execute(delete(RagEmbedding).where(RagEmbedding.capture_id == capture_id))

    async def count_stale_citations(
        self, db: AsyncSession, *, model: str, user_id: str | None = None
    ) -> int:
        result = await db.execute(
            _COUNT_STALE_CITATIONS_SQL,
            {"model": model, "user_id": user_id},
        )
        return int(result.scalar_one())

    async def count_stale_captures(
        self, db: AsyncSession, *, model: str, user_id: str | None = None
    ) -> int:
        result = await db.execute(
            _COUNT_STALE_CAPTURES_SQL,
            {"model": model, "user_id": user_id},
        )
        return int(result.scalar_one())

    async def find_stale_citation_candidates(
        self, db: AsyncSession, *, model: str, limit: int, user_id: str | None = None
    ) -> list[CitationEmbeddingCandidate]:
        """Stale citations joined with the full document context.

        Used by the batch refresh path so the whole stale set can be embedded
        in chunks without a second per-row round-trip.
        """
        result = await db.execute(
            _FIND_STALE_CITATION_CANDIDATES_SQL,
            {"model": model, "limit": limit, "user_id": user_id},
        )
        return [_citation_candidate(row) for row in result.mappings()]

    async def find_stale_capture_candidates(
        self, db: AsyncSession, *, model: str, limit: int, user_id: str | None = None
    ) -> list[CaptureEmbeddingCandidate]:
        result = await db.execute(
            _FIND_STALE_CAPTURE_CANDIDATES_SQL,
            {"model": model, "limit": limit, "user_id": user_id},
        )
        return [_capture_candidate(row) for row in result.mappings()]
