"""Transcript-chunk embedding data access.

Owns the `rag_embeddings` rows that represent transcript chunks — those keyed
by `source_id` + `chunk_index` with no citation/capture/takeaway/section FK.
The other embedding kinds each have their own repository; this one is the
home for the source-level chunk rows produced during transcript embedding.
"""

from __future__ import annotations

from typing import Any

from sqlalchemy import delete, insert, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.database import RagEmbedding, Source


class TranscriptEmbeddingRepository:
    async def get_source(self, db: AsyncSession, source_id: int) -> Source | None:
        result = await db.execute(select(Source).where(Source.id == source_id))
        return result.scalar_one_or_none()

    async def delete_chunks_for_source(self, db: AsyncSession, source_id: int) -> None:
        """Delete the transcript-chunk embeddings for a source.

        Scoped to ``rag_embeddings.source_id`` only — does NOT touch the
        citation/capture/takeaway/section embeddings for the same source
        (those are owned by their respective embedding repositories).
        """
        await db.execute(delete(RagEmbedding).where(RagEmbedding.source_id == source_id))

    async def insert_chunks(self, db: AsyncSession, rows: list[dict[str, Any]]) -> None:
        """Bulk-insert transcript-chunk embedding rows."""
        if not rows:
            return
        await db.execute(insert(RagEmbedding), rows)
