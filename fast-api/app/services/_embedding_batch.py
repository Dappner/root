"""Shared batch helper for the four `refresh_stale` paths.

Voyage caps each `embed` call at 128 inputs, so the refresh loop chunks at
that boundary. A bulk `pg_insert(...).values([...])` per chunk turns 128
upsert round-trips into one.
"""

from __future__ import annotations

from collections.abc import Sequence
from datetime import datetime
from typing import Literal, NamedTuple, cast

from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.core.logging import get_logger
from app.integrations.voyage import VoyageClient
from app.models.database import RagEmbedding

logger = get_logger(__name__)

_VOYAGE_BATCH_SIZE = 128

FkColumn = Literal["citation_id", "capture_id", "section_id", "takeaway_id"]


class PreparedEmbedding(NamedTuple):
    entity_id: int
    content_sha256: str
    document: str


async def refresh_stale_embeddings(
    *,
    voyage: VoyageClient,
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
    for start in range(0, len(rows), _VOYAGE_BATCH_SIZE):
        chunk = rows[start : start + _VOYAGE_BATCH_SIZE]
        try:
            embed_result = await voyage.embed(
                texts=[p.document for p in chunk],
                model=model,
                input_type="document",
            )
        except Exception:
            logger.exception(
                "voyage batch embed failed",
                extra={"fk_column": fk_column, "chunk_size": len(chunk)},
            )
            continue

        vectors = cast(list[Sequence[float]], embed_result.embeddings)
        if len(vectors) != len(chunk):
            logger.error(
                "voyage returned unexpected vector count",
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
