"""Shared batch helper for the four `refresh_stale` paths.

Voyage (the production Embedder) caps each embed call at 128 inputs, so the
refresh loop chunks at that boundary. A bulk `pg_insert(...).values([...])` per chunk turns 128
upsert round-trips into one.
"""

from __future__ import annotations

from datetime import datetime
from typing import Literal, NamedTuple

from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.core.logging import get_logger
from app.models.database import RagEmbedding
from app.providers.embedder import Embedder

logger = get_logger(__name__)

_EMBED_BATCH_SIZE = 128

FkColumn = Literal["citation_id", "capture_id", "section_id", "takeaway_id"]


class PreparedEmbedding(NamedTuple):
    entity_id: int
    content_sha256: str
    document: str


async def refresh_stale_embeddings(
    *,
    embedder: Embedder,
    session_factory: async_sessionmaker[AsyncSession],
    model: str,
    fk_column: FkColumn,
    prepared: list[PreparedEmbedding],
    now: datetime,
) -> int:
    # Drop rows whose document rendered empty; keeps vector[i] ↔ row[i] aligned.
    rows = [p for p in prepared if p.document.strip()]
    if not rows:
        return 0

    processed = 0
    for start in range(0, len(rows), _EMBED_BATCH_SIZE):
        chunk = rows[start : start + _EMBED_BATCH_SIZE]
        try:
            vectors = await embedder.embed_documents([p.document for p in chunk])
        except Exception:
            logger.exception(
                "batch embed failed",
                extra={"fk_column": fk_column, "chunk_size": len(chunk)},
            )
            continue

        if len(vectors) != len(chunk):
            logger.error(
                "embedder returned unexpected vector count",
                extra={
                    "fk_column": fk_column,
                    "expected": len(chunk),
                    "got": len(vectors),
                },
            )
            continue

        values = [
            {
                fk_column: p.entity_id,
                "content_sha256": p.content_sha256,
                "embedding": vector,
                "model": model,
                "created_at": now,
            }
            for p, vector in zip(chunk, vectors)
        ]
        stmt = pg_insert(RagEmbedding).values(values)
        stmt = stmt.on_conflict_do_update(
            index_elements=[fk_column],
            set_={
                "content_sha256": stmt.excluded.content_sha256,
                "embedding": stmt.excluded.embedding,
                "model": stmt.excluded.model,
                "created_at": stmt.excluded.created_at,
            },
        )

        async with session_factory() as db:
            await db.execute(stmt)
            await db.commit()

        processed += len(chunk)

    return processed
