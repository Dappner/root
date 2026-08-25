"""Shared upsert for rag_embeddings rows keyed by an entity FK column."""

from collections.abc import Sequence
from datetime import datetime

from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.database import RagEmbedding


async def upsert_rag_embedding(
    db: AsyncSession,
    *,
    fk_column: str,
    entity_id: int,
    content_sha256: str,
    embedding: Sequence[float],
    model: str,
    created_at: datetime,
) -> None:
    """Insert or refresh the embedding row for one entity.

    rag_embeddings holds one row per embedded entity, keyed by a unique FK
    column (citation_id, capture_id, section_id, takeaway_id). On conflict the
    content hash, vector, model, and timestamp are replaced.
    """
    stmt = pg_insert(RagEmbedding).values(
        **{fk_column: entity_id},
        content_sha256=content_sha256,
        embedding=embedding,
        model=model,
        created_at=created_at,
    )
    stmt = stmt.on_conflict_do_update(
        index_elements=[fk_column],
        set_={
            "content_sha256": stmt.excluded.content_sha256,
            "embedding": stmt.excluded.embedding,
            "model": stmt.excluded.model,
            "created_at": stmt.excluded.created_at,
        },
    )
    await db.execute(stmt)
