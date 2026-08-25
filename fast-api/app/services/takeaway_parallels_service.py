"""Find cross-source takeaway parallels via nearest-neighbor search.

The synthesis ladder in Root puts notes on top of takeaways: notes are drafted
when the user notices the same idea recurring across sources. This service
surfaces those parallels — semantically nearest takeaways from *other* sources
— so the recognition happens in-product instead of relying on memory.

No caching today: the ANN query is a single indexed lookup, and at current
scale the cost of correct invalidation (target sha + corpus version + embedding
lag gate) outweighs the latency saved. Add caching back when measurements
justify it; the cache infrastructure in app/core/cache.py is ready to use.

If/when this gets slow at scale, materialize into a `takeaway_parallels` table
fed by the embedding pipeline — see note in app/core/cache.py.
"""

from __future__ import annotations

from pgvector.sqlalchemy import Vector
from sqlalchemy import Float, bindparam, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.ownership import require_takeaway
from app.models.database import RagEmbedding, Source, SourceTakeaway
from app.schemas.takeaways import ParallelTakeaway

DEFAULT_LIMIT = 3


class TakeawayParallelsService:
    async def get_parallels(
        self,
        db: AsyncSession,
        *,
        user_id: str,
        takeaway_id: int,
        limit: int = DEFAULT_LIMIT,
    ) -> list[ParallelTakeaway]:
        takeaway = await require_takeaway(db, takeaway_id, user_id)
        if takeaway.content_sha256 is None:
            # Not yet embedded — no parallels to surface.
            return []

        # Gate the target embedding fetch on content_sha. The takeaway's
        # content_sha256 advances synchronously on edit, but the rag_embeddings
        # row is rewritten asynchronously by TakeawayEmbeddingService. A
        # request in that window must not compute parallels from the stale
        # vector — return [] until the embedding catches up.
        target_row = await db.execute(
            select(RagEmbedding.embedding).where(
                RagEmbedding.takeaway_id == takeaway_id,
                RagEmbedding.content_sha256 == takeaway.content_sha256,
            )
        )
        target_embedding = target_row.scalar_one_or_none()
        if target_embedding is None:
            return []

        embedding_param = bindparam("embedding", target_embedding, type_=Vector)
        distance = RagEmbedding.embedding.op("<=>")(embedding_param)
        similarity = 1 - func.cast(distance, Float)

        stmt = (
            select(
                SourceTakeaway.id.label("takeaway_id"),
                SourceTakeaway.source_id.label("source_id"),
                Source.title.label("source_title"),
                Source.type.label("source_type"),
                SourceTakeaway.title.label("title"),
                func.left(SourceTakeaway.body, 200).label("snippet"),
                similarity.label("similarity"),
            )
            .select_from(RagEmbedding)
            .join(SourceTakeaway, SourceTakeaway.id == RagEmbedding.takeaway_id)
            .join(Source, Source.id == SourceTakeaway.source_id)
            .where(
                RagEmbedding.takeaway_id.is_not(None),
                SourceTakeaway.user_id == user_id,
                SourceTakeaway.id != takeaway_id,
                SourceTakeaway.source_id != takeaway.source_id,  # cross-source only
            )
            .order_by(distance)
            .limit(limit)
        )

        result = await db.execute(stmt, {"embedding": target_embedding})
        return [
            ParallelTakeaway(
                takeaway_id=row.takeaway_id,
                source_id=row.source_id,
                source_title=row.source_title,
                source_type=row.source_type,
                title=row.title,
                snippet=row.snippet,
                similarity=float(row.similarity),
            )
            for row in result.fetchall()
        ]


def takeaway_parallels_service() -> TakeawayParallelsService:
    return TakeawayParallelsService()
