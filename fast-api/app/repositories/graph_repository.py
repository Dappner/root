"""Data access for the full-library knowledge graph.

DATA ACCESS ONLY: builds/executes queries and returns row tuples / scalars.
All graph construction (GraphNode/GraphEdge, aggregation, dedup, capping,
scoring) lives in `app.services.graph_service`.
"""

from __future__ import annotations

from collections.abc import Sequence
from typing import Any

from pgvector.sqlalchemy import Vector
from sqlalchemy import Float, Row, bindparam, func, literal, select, union_all
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.database import (
    Note,
    NoteCitation,
    RagEmbedding,
    Source,
    SourceTakeaway,
    SourceTakeawayCitation,
)


class GraphRepository:
    async def fetch_takeaway_nodes(self, db: AsyncSession, *, user_id: str) -> Sequence[Row[Any]]:
        # Takeaways always have a source (NOT NULL in schema), so the join is
        # safe. Order so downstream loops (which dict-insert by row order)
        # produce stable output across requests.
        result = await db.execute(
            select(
                SourceTakeaway.id,
                SourceTakeaway.title,
                SourceTakeaway.source_id,
                Source.title.label("source_title"),
                Source.type.label("source_type"),
            )
            .join(Source, Source.id == SourceTakeaway.source_id)
            .where(SourceTakeaway.user_id == user_id)
            .order_by(SourceTakeaway.id)
        )
        return result.all()

    async def fetch_note_nodes(self, db: AsyncSession, *, user_id: str) -> Sequence[Row[Any]]:
        # Notes may have a NULL source_id (global notes), so outer join.
        result = await db.execute(
            select(
                Note.id,
                Note.title,
                Note.source_id,
                Source.title.label("source_title"),
                Source.type.label("source_type"),
            )
            .outerjoin(Source, Source.id == Note.source_id)
            .where(Note.user_id == user_id)
            .order_by(Note.id)
        )
        return result.all()

    async def fetch_structural_pairs(self, db: AsyncSession, *, user_id: str) -> Sequence[Row[Any]]:
        # Pull every (node_id, citation_id) pair for this user via UNION ALL —
        # one query for both kinds. Filtering on user_id at this level (rather
        # than relying on the citation's ownership) keeps the result set tied
        # to entities we've already collected as nodes.
        takeaway_pairs = (
            select(
                literal("takeaway").label("kind"),
                SourceTakeawayCitation.takeaway_id.label("entity_id"),
                SourceTakeawayCitation.citation_id.label("citation_id"),
            )
            .select_from(SourceTakeawayCitation)
            .join(
                SourceTakeaway,
                SourceTakeaway.id == SourceTakeawayCitation.takeaway_id,
            )
            .where(SourceTakeaway.user_id == user_id)
        )
        note_pairs = (
            select(
                literal("note").label("kind"),
                NoteCitation.note_id.label("entity_id"),
                NoteCitation.citation_id.label("citation_id"),
            )
            .select_from(NoteCitation)
            .join(Note, Note.id == NoteCitation.note_id)
            .where(Note.user_id == user_id)
        )
        result = await db.execute(union_all(takeaway_pairs, note_pairs))
        return result.all()

    async def fetch_target_embedding(
        self, db: AsyncSession, *, takeaway_id: int
    ) -> Row[Any] | None:
        # sha-gated target fetch: only the embedding matching the takeaway's
        # current content hash.
        result = await db.execute(
            select(RagEmbedding.embedding, SourceTakeaway.content_sha256)
            .join(SourceTakeaway, SourceTakeaway.id == RagEmbedding.takeaway_id)
            .where(
                RagEmbedding.takeaway_id == takeaway_id,
                RagEmbedding.content_sha256 == SourceTakeaway.content_sha256,
            )
        )
        return result.first()

    async def fetch_top_k_neighbors(
        self,
        db: AsyncSession,
        *,
        user_id: str,
        target_embedding: Any,
        exclude_takeaway_id: int,
        exclude_source_id: int | None,
        limit: int,
    ) -> Sequence[Row[Any]]:
        # pgvector top-K ANN: cross-source, exclude self. No similarity floor —
        # the graph wants every edge that exists; the service maps each row to
        # a node id + score.
        embedding_param = bindparam("embedding", target_embedding, type_=Vector)
        distance = RagEmbedding.embedding.op("<=>")(embedding_param)
        similarity = 1 - func.cast(distance, Float)

        stmt = (
            select(
                SourceTakeaway.id.label("takeaway_id"),
                similarity.label("similarity"),
            )
            .select_from(RagEmbedding)
            .join(SourceTakeaway, SourceTakeaway.id == RagEmbedding.takeaway_id)
            .where(
                RagEmbedding.takeaway_id.is_not(None),
                SourceTakeaway.user_id == user_id,
                SourceTakeaway.id != exclude_takeaway_id,
                SourceTakeaway.source_id != exclude_source_id,
            )
            .order_by(distance)
            .limit(limit)
        )
        result = await db.execute(stmt, {"embedding": target_embedding})
        return result.all()
