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
        t.id,
        t.title,
        t.body,
        t.content_sha256,
        s.title AS source_title
    FROM source_takeaways t
    JOIN sources s ON s.id = t.source_id
    WHERE t.id = :takeaway_id AND t.user_id = :user_id
    """)

# `:user_id` NULL scans all users; a specific id scopes the admin refresh.
_FIND_STALE_SQL = text("""
    SELECT
        t.id,
        t.title,
        t.body,
        t.content_sha256,
        s.title AS source_title
    FROM source_takeaways t
    JOIN sources s ON s.id = t.source_id
    LEFT JOIN rag_embeddings e ON e.takeaway_id = t.id
    WHERE t.content_sha256 IS NOT NULL
      AND (CAST(:user_id AS TEXT) IS NULL OR t.user_id = CAST(:user_id AS TEXT))
      AND (
        e.takeaway_id IS NULL
        OR e.model IS DISTINCT FROM :model
        OR e.content_sha256 IS DISTINCT FROM t.content_sha256
      )
    ORDER BY t.created_at DESC
    LIMIT :limit
    """)

_COUNT_STALE_SQL = text("""
    SELECT COUNT(*)
    FROM source_takeaways t
    LEFT JOIN rag_embeddings e ON e.takeaway_id = t.id
    WHERE t.content_sha256 IS NOT NULL
      AND (CAST(:user_id AS TEXT) IS NULL OR t.user_id = CAST(:user_id AS TEXT))
      AND (
        e.takeaway_id IS NULL
        OR e.model IS DISTINCT FROM :model
        OR e.content_sha256 IS DISTINCT FROM t.content_sha256
      )
    """)


@dataclass(frozen=True)
class TakeawayEmbeddingCandidate:
    id: int
    title: str | None
    body: str | None
    content_sha256: str | None
    source_title: str | None


def _candidate(row: RowMapping) -> TakeawayEmbeddingCandidate:
    return TakeawayEmbeddingCandidate(
        id=row["id"],
        title=row["title"],
        body=row["body"],
        content_sha256=row["content_sha256"],
        source_title=row["source_title"],
    )


class TakeawayEmbeddingRepository:
    async def get_candidate(
        self, db: AsyncSession, *, takeaway_id: int, user_id: str
    ) -> TakeawayEmbeddingCandidate | None:
        result = await db.execute(
            _GET_CANDIDATE_SQL,
            {"takeaway_id": takeaway_id, "user_id": user_id},
        )
        row = result.mappings().one_or_none()
        return _candidate(row) if row is not None else None

    async def upsert_embedding(
        self,
        db: AsyncSession,
        *,
        takeaway_id: int,
        content_sha256: str,
        embedding: Sequence[float],
        model: str,
        created_at: datetime,
    ) -> None:
        await upsert_rag_embedding(
            db,
            fk_column="takeaway_id",
            entity_id=takeaway_id,
            content_sha256=content_sha256,
            embedding=embedding,
            model=model,
            created_at=created_at,
        )

    async def delete_embedding(self, db: AsyncSession, takeaway_id: int) -> None:
        await db.execute(delete(RagEmbedding).where(RagEmbedding.takeaway_id == takeaway_id))

    async def count_stale(self, db: AsyncSession, *, model: str, user_id: str | None = None) -> int:
        result = await db.execute(
            _COUNT_STALE_SQL,
            {"model": model, "user_id": user_id},
        )
        return int(result.scalar_one())

    async def find_stale_candidates(
        self, db: AsyncSession, *, model: str, limit: int, user_id: str | None = None
    ) -> list[TakeawayEmbeddingCandidate]:
        result = await db.execute(
            _FIND_STALE_SQL,
            {"model": model, "limit": limit, "user_id": user_id},
        )
        return [_candidate(row) for row in result.mappings()]
