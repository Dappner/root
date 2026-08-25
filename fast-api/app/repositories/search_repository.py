"""Database repository for vector search."""

from collections.abc import Callable, Sequence
from typing import Any

from pgvector.sqlalchemy import Vector
from sqlalchemy import Float, Select, bindparam, func, literal, null, select
from sqlalchemy.engine import Row
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql import ColumnElement

from app.core.logging import get_logger
from app.models.database import (
    Capture,
    Citation,
    RagEmbedding,
    Source,
    SourceSection,
    SourceTakeaway,
)
from app.schemas.rag import HitKind, RetrievalHit

logger = get_logger(__name__)


def _distance_and_score(
    embedding: list[float],
) -> tuple[ColumnElement[Any], ColumnElement[Any]]:
    """Build the cosine-distance expression and its 0..1 similarity score."""
    embedding_param = bindparam("embedding", embedding, type_=Vector)
    distance = RagEmbedding.embedding.op("<=>")(embedding_param)
    score_expr = 1 - func.cast(distance, Float)
    return distance, score_expr


def _source_columns() -> tuple[ColumnElement[Any], ...]:
    """Source metadata columns shared by every hit kind."""
    return (
        Source.title.label("source_title"),
        Source.type.label("source_type"),
        Source.author.label("source_author"),
        Source.label.label("source_label"),
        Source.status.label("source_status"),
        Source.published_at.label("source_published_at"),
        Source.last_active_at.label("source_last_active_at"),
    )


class SearchRepository:
    """Repository for vector search operations."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def _vector_search_hits(
        self,
        *,
        kind: HitKind,
        embedding: list[float],
        user_id: str,
        source_ids: list[int] | None,
        source_types: list[str] | None,
        limit: int,
        entity: Any,
        rag_fk: Any,
        text_expr: Any,
        owner_col: Any,
        source_join_outer: bool = True,
        section_id_expr: Any | None = None,
        extra_columns: Sequence[Any] = (),
        refine: Callable[[Select[Any]], Select[Any]] | None = None,
        extra_hit_fields: Callable[[Row[Any]], dict[str, Any]] | None = None,
    ) -> list[RetrievalHit]:
        """Shared vector-search core for entity-backed hit kinds.

        Each public method declares only what differs per entity: the joined
        table, the text expression, ownership column, extra selected columns,
        and any extra joins/filters (via ``refine``). Column order, filtering,
        ordering, and hit mapping are identical across kinds and live here.
        """
        try:
            distance, score_expr = _distance_and_score(embedding)
            section_col = (
                section_id_expr if section_id_expr is not None else null().label("section_id")
            )

            stmt = (
                select(
                    literal(kind).label("kind"),
                    entity.id.label("entity_id"),
                    text_expr,
                    entity.source_id,
                    *_source_columns(),
                    section_col,
                    *extra_columns,
                    score_expr.label("score"),
                    func.row_number().over(order_by=distance).label("vec_rank"),
                )
                .select_from(entity)
                .join(RagEmbedding, rag_fk == entity.id)
            )
            if source_join_outer:
                stmt = stmt.outerjoin(Source, Source.id == entity.source_id)
            else:
                stmt = stmt.join(Source, Source.id == entity.source_id)

            stmt = stmt.where(owner_col == user_id)
            if refine is not None:
                stmt = refine(stmt)

            if source_ids:
                stmt = stmt.where(entity.source_id.in_(source_ids))
            if source_types:
                stmt = stmt.where(Source.type.in_(source_types))

            stmt = stmt.order_by(distance).limit(limit)

            result = await self.db.execute(stmt, {"embedding": embedding})
            rows = result.fetchall()

            return [
                RetrievalHit(
                    kind=kind,
                    entity_id=row.entity_id,
                    text=row.text,
                    source_id=row.source_id,
                    source_title=row.source_title,
                    source_type=row.source_type,
                    source_author=row.source_author,
                    source_label=row.source_label,
                    source_status=row.source_status,
                    source_published_at=row.source_published_at,
                    source_last_active_at=row.source_last_active_at,
                    section_id=row.section_id,
                    score=float(row.score),
                    vec_rank=row.vec_rank,
                    **(extra_hit_fields(row) if extra_hit_fields is not None else {}),
                )
                for row in rows
            ]

        except Exception as e:
            logger.error(f"Vector search {kind} failed: {e}", exc_info=True)
            raise

    async def vector_search_citations(
        self,
        embedding: list[float],
        user_id: str,
        source_ids: list[int] | None,
        source_types: list[str] | None,
        limit: int,
    ) -> list[RetrievalHit]:
        """Vector search over citations."""
        return await self._vector_search_hits(
            kind="citation",
            embedding=embedding,
            user_id=user_id,
            source_ids=source_ids,
            source_types=source_types,
            limit=limit,
            entity=Citation,
            rag_fk=RagEmbedding.citation_id,
            text_expr=Citation.text,
            owner_col=Citation.user_id,
            extra_columns=(Citation.speaker, Citation.context),
            extra_hit_fields=lambda row: {
                "citation_speaker": row.speaker,
                "citation_context": row.context,
            },
        )

    async def vector_search_captures(
        self,
        embedding: list[float],
        user_id: str,
        source_ids: list[int] | None,
        source_types: list[str] | None,
        limit: int,
    ) -> list[RetrievalHit]:
        """Vector search over captures."""
        return await self._vector_search_hits(
            kind="capture",
            embedding=embedding,
            user_id=user_id,
            source_ids=source_ids,
            source_types=source_types,
            limit=limit,
            entity=Capture,
            rag_fk=RagEmbedding.capture_id,
            text_expr=Capture.content.label("text"),
            owner_col=Capture.user_id,
            extra_columns=(
                Capture.citation_id,
                Citation.text.label("citation_text"),
                Citation.speaker.label("citation_speaker"),
                Citation.context.label("citation_context"),
            ),
            refine=lambda stmt: stmt.outerjoin(Citation, Citation.id == Capture.citation_id).where(
                Capture.deleted_at.is_(None)
            ),
            extra_hit_fields=lambda row: {
                "citation_id": row.citation_id,
                "citation_text": row.citation_text,
                "citation_speaker": row.citation_speaker,
                "citation_context": row.citation_context,
            },
        )

    async def vector_search_takeaways(
        self,
        embedding: list[float],
        user_id: str,
        source_ids: list[int] | None,
        source_types: list[str] | None,
        limit: int,
    ) -> list[RetrievalHit]:
        """Vector search over source takeaways."""
        return await self._vector_search_hits(
            kind="takeaway",
            embedding=embedding,
            user_id=user_id,
            source_ids=source_ids,
            source_types=source_types,
            limit=limit,
            entity=SourceTakeaway,
            rag_fk=RagEmbedding.takeaway_id,
            text_expr=func.concat(SourceTakeaway.title, " - ", SourceTakeaway.body).label("text"),
            owner_col=SourceTakeaway.user_id,
            extra_columns=(
                SourceTakeaway.title.label("takeaway_title"),
                SourceTakeaway.body.label("takeaway_body"),
            ),
            extra_hit_fields=lambda row: {
                "takeaway_title": row.takeaway_title,
                "takeaway_body": row.takeaway_body,
            },
        )

    async def vector_search_source_sections(
        self,
        embedding: list[float],
        user_id: str,
        source_ids: list[int] | None,
        source_types: list[str] | None,
        limit: int,
    ) -> list[RetrievalHit]:
        """Vector search over source section summaries."""
        return await self._vector_search_hits(
            kind="source_section_summary",
            embedding=embedding,
            user_id=user_id,
            source_ids=source_ids,
            source_types=source_types,
            limit=limit,
            entity=SourceSection,
            rag_fk=RagEmbedding.section_id,
            text_expr=func.concat_ws(
                " - ",
                SourceSection.title,
                SourceSection.subtitle,
                SourceSection.summary,
            ).label("text"),
            owner_col=Source.user_id,
            source_join_outer=False,
            section_id_expr=SourceSection.id.label("section_id"),
            extra_columns=(
                SourceSection.title.label("section_title"),
                SourceSection.subtitle.label("section_subtitle"),
                SourceSection.summary.label("section_summary"),
            ),
            refine=lambda stmt: stmt.where(SourceSection.summary.isnot(None)),
            extra_hit_fields=lambda row: {
                "section_title": row.section_title,
                "section_subtitle": row.section_subtitle,
                "section_summary": row.section_summary,
            },
        )

    async def vector_search_transcript_chunks(
        self,
        embedding: list[float],
        user_id: str,
        source_ids: list[int] | None,
        source_types: list[str] | None,
        limit: int,
    ) -> list[Row]:
        """Vector search over transcript chunks.

        Returns SQLAlchemy Row objects with named attributes — no text,
        caller hydrates from R2. Structurally different from the entity-backed
        kinds (no entity table; RagEmbedding rows are the unit), so it does not
        go through _vector_search_hits.
        """
        try:
            distance, score_expr = _distance_and_score(embedding)

            stmt = (
                select(
                    RagEmbedding.source_id,
                    RagEmbedding.chunk_index,
                    Source.episode_id,
                    Source.video_id,
                    *_source_columns(),
                    score_expr.label("score"),
                    func.row_number().over(order_by=distance).label("vec_rank"),
                )
                .select_from(RagEmbedding)
                .join(Source, Source.id == RagEmbedding.source_id)
                .where(RagEmbedding.source_id.isnot(None))
                .where(RagEmbedding.chunk_index.isnot(None))
                .where(Source.user_id == user_id)
            )

            if source_ids:
                stmt = stmt.where(RagEmbedding.source_id.in_(source_ids))
            if source_types:
                stmt = stmt.where(Source.type.in_(source_types))

            stmt = stmt.order_by(distance).limit(limit)

            result = await self.db.execute(stmt, {"embedding": embedding})
            return list(result.fetchall())

        except Exception as e:
            logger.error(f"Vector search transcript chunks failed: {e}", exc_info=True)
            raise
