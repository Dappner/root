from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import delete, text
from sqlalchemy.engine import RowMapping
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.database import RagEmbedding
from app.repositories._rag_embedding_upsert import upsert_rag_embedding

_GET_CANDIDATE_SQL = text("""
    SELECT
        ss.id,
        ss.title,
        ss.subtitle,
        ss.summary,
        ss.summary_sha256,
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
    FROM source_sections ss
    JOIN sources s ON s.id = ss.source_id
    LEFT JOIN podcast_episodes pe ON pe.id = s.episode_id
    LEFT JOIN shows sh ON sh.id = pe.show_id
    LEFT JOIN videos v ON v.id = s.video_id
    LEFT JOIN channels ch ON ch.id = v.channel_id
    WHERE ss.id = :section_id AND s.user_id = :user_id
    """)

_FIND_STALE_SQL = text("""
    SELECT
        ss.id,
        ss.title,
        ss.subtitle,
        ss.summary,
        ss.summary_sha256,
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
    FROM source_sections ss
    JOIN sources s ON s.id = ss.source_id
    LEFT JOIN podcast_episodes pe ON pe.id = s.episode_id
    LEFT JOIN shows sh ON sh.id = pe.show_id
    LEFT JOIN videos v ON v.id = s.video_id
    LEFT JOIN channels ch ON ch.id = v.channel_id
    LEFT JOIN rag_embeddings e ON e.section_id = ss.id
    WHERE ss.summary IS NOT NULL
      AND ss.summary <> ''
      AND ss.summary_sha256 IS NOT NULL
      AND (CAST(:user_id AS TEXT) IS NULL OR s.user_id = CAST(:user_id AS TEXT))
      AND (
        e.section_id IS NULL
        OR e.model IS DISTINCT FROM :model
        OR e.content_sha256 IS DISTINCT FROM ss.summary_sha256
      )
    ORDER BY ss.created_at DESC
    LIMIT :limit
    """)

_COUNT_STALE_SQL = text("""
    SELECT COUNT(*)
    FROM source_sections ss
    JOIN sources s ON s.id = ss.source_id
    LEFT JOIN rag_embeddings e ON e.section_id = ss.id
    WHERE ss.summary IS NOT NULL
      AND ss.summary <> ''
      AND ss.summary_sha256 IS NOT NULL
      AND (CAST(:user_id AS TEXT) IS NULL OR s.user_id = CAST(:user_id AS TEXT))
      AND (
        e.section_id IS NULL
        OR e.model IS DISTINCT FROM :model
        OR e.content_sha256 IS DISTINCT FROM ss.summary_sha256
      )
    """)


@dataclass(frozen=True)
class SectionEmbeddingCandidate:
    id: int
    title: str | None
    subtitle: str | None
    summary: str | None
    summary_sha256: str | None
    source_title: str | None
    source_type: str | None
    source_author: str | None
    source_published_at: datetime | None
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


def _candidate(row: RowMapping) -> SectionEmbeddingCandidate:
    return SectionEmbeddingCandidate(
        id=row["id"],
        title=row["title"],
        subtitle=row["subtitle"],
        summary=row["summary"],
        summary_sha256=row["summary_sha256"],
        source_title=row["source_title"],
        source_type=row["source_type"],
        source_author=row["source_author"],
        source_published_at=row["source_published_at"],
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


class SectionEmbeddingRepository:
    async def get_candidate(
        self, db: AsyncSession, *, section_id: int, user_id: str
    ) -> SectionEmbeddingCandidate | None:
        result = await db.execute(
            _GET_CANDIDATE_SQL,
            {"section_id": section_id, "user_id": user_id},
        )
        row = result.mappings().one_or_none()
        return _candidate(row) if row is not None else None

    async def upsert_embedding(
        self,
        db: AsyncSession,
        *,
        section_id: int,
        content_sha256: str,
        embedding: Sequence[float],
        model: str,
        created_at: datetime,
    ) -> None:
        await upsert_rag_embedding(
            db,
            fk_column="section_id",
            entity_id=section_id,
            content_sha256=content_sha256,
            embedding=embedding,
            model=model,
            created_at=created_at,
        )

    async def delete_embedding(self, db: AsyncSession, section_id: int) -> None:
        await db.execute(delete(RagEmbedding).where(RagEmbedding.section_id == section_id))

    async def count_stale(self, db: AsyncSession, *, model: str, user_id: str | None = None) -> int:
        result = await db.execute(
            _COUNT_STALE_SQL,
            {"model": model, "user_id": user_id},
        )
        return int(result.scalar_one())

    async def find_stale_candidates(
        self, db: AsyncSession, *, model: str, limit: int, user_id: str | None = None
    ) -> list[SectionEmbeddingCandidate]:
        result = await db.execute(
            _FIND_STALE_SQL,
            {"model": model, "limit": limit, "user_id": user_id},
        )
        return [_candidate(row) for row in result.mappings()]
