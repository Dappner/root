"""Unified search action for Jetflow agent."""

from typing import Literal

from jetflow import ActionResult, action
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.core.streaming.hit_store import HitStore
from app.schemas.rag import RetrievalHit
from app.services.agent.citations import build_citations_from_hits
from app.services.agent.filtering import SourceType, to_source_type_filter
from app.services.agent.formatting import format_hits_for_llm
from app.services.embedding import EmbeddingService
from app.services.search_orchestrator import vector_search

logger = get_logger(__name__)

EntityType = Literal[
    "capture", "citation", "takeaway", "source_section_summary", "transcript_chunk"
]


class SearchSchema(BaseModel):
    """Search the user's personal knowledge base.

    Use this to find relevant content from the user's notes, highlights,
    synthesized insights, and source section summaries.

    **entity_types** controls what content is searched:
    - Omit (null) to search everything — best for general questions
    - ["capture"] — user's own notes and personal reflections
    - ["citation"] — quotes and highlights from sources
    - ["takeaway"] — synthesized insights and key ideas per source
    - ["source_section_summary"] — chapter/section summaries
    - ["transcript_chunk"] — raw transcript segments from podcasts and videos
    - Combine freely, e.g. ["capture", "citation"] for all user-created content

    **source_ids** and **source_types** narrow results to specific sources.
    Use list_user_sources first if you need to look up a source ID by name.
    """

    query: str = Field(description="The search query")
    entity_types: list[EntityType] | None = Field(
        default=None,
        description=(
            "Which content types to search. Null searches everything. "
            "Options: capture, citation, takeaway, source_section_summary, transcript_chunk"
        ),
    )
    source_ids: list[int] | None = Field(
        default=None,
        description="Limit search to specific sources by ID",
    )
    source_types: list[SourceType] | None = Field(
        default=None,
        description="Limit search to specific source types (book, article, podcast, video, pdf)",
    )


@action(schema=SearchSchema)
class Search:
    """Search the user's knowledge base with optional entity type and source filters."""

    def __init__(
        self,
        db: AsyncSession,
        user_id: str,
        embedder: EmbeddingService,
        hit_store: HitStore,
    ):
        self.db = db
        self.user_id = user_id
        self.embedder = embedder
        self.hit_store = hit_store

    async def __call__(self, params: SearchSchema, citation_start: int = 1) -> ActionResult:
        logger.info(
            f"[search] query='{params.query[:100]}', entity_types={params.entity_types}, "
            f"source_ids={params.source_ids}, source_types={params.source_types}, "
            f"citation_start={citation_start}"
        )

        try:
            # Scale limit per type so total candidates stay ~75 regardless of
            # how many types are active. Fewer active types → more per type.
            all_types = [
                "capture",
                "citation",
                "takeaway",
                "source_section_summary",
                "transcript_chunk",
            ]
            active_count = len(params.entity_types) if params.entity_types else len(all_types)
            limit_per_type = max(15, 75 // active_count)

            candidates = await vector_search(
                query=params.query,
                user_id=self.user_id,
                db=self.db,
                embedder=self.embedder,
                source_ids=params.source_ids,
                source_types=to_source_type_filter(params.source_types),
                entity_types=params.entity_types,
                limit=limit_per_type,
            )
            hits = await self.embedder.rerank_hits(params.query, candidates, top_k=20)

            annotated_hits = self.hit_store.register_hits(hits, citation_start)
            content = self._format_hits_content(annotated_hits)
            citations = build_citations_from_hits(self.hit_store.all_hits_with_ids())

            capture_count = sum(1 for h in hits if h.kind == "capture")
            citation_count = sum(1 for h in hits if h.kind == "citation")
            takeaway_count = sum(1 for h in hits if h.kind == "takeaway")
            section_count = sum(1 for h in hits if h.kind == "source_section_summary")
            chunk_count = sum(1 for h in hits if h.kind == "transcript_chunk")

            stats = {
                "total": len(hits),
                "captures": capture_count,
                "citations": citation_count,
                "takeaways": takeaway_count,
                "sections": section_count,
                "transcript_chunks": chunk_count,
            }
            summary_parts = [f"{k}={v}" for k, v in stats.items() if k != "total"]
            logger.info(f"[search] Success: {len(hits)} hits ({', '.join(summary_parts)})")

            return ActionResult(
                content=content,
                citations=citations,
                summary=f"Found {len(hits)} result(s) ({', '.join(summary_parts)})",
                metadata={"stats": stats},
            )
        except Exception as e:
            logger.error(f"[search] Failed: {e}", exc_info=True)
            raise

    def _format_hits_content(self, hits_with_ids: list[tuple[RetrievalHit, int]]) -> str:
        return format_hits_for_llm(hits_with_ids)
