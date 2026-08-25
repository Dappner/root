"""Source-scoped context action for the reflection agent."""

from typing import Literal

from jetflow import ActionResult, action
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.core.streaming.hit_store import HitStore
from app.repositories.capture_repository import CaptureRepository
from app.repositories.citation_repository import CitationRepository
from app.repositories.source_repository import SourceRepository
from app.repositories.source_section_repository import SourceSectionRepository
from app.repositories.source_takeaway_repository import SourceTakeawayRepository
from app.schemas.rag import RetrievalHit
from app.services.agent.citations import build_citations_from_hits
from app.services.agent.formatting import format_hits_for_llm

logger = get_logger(__name__)

ContextKind = Literal["citations", "captures", "takeaways", "sections"]


class GetSourceContextSchema(BaseModel):
    """Load source material directly for reflection and takeaway synthesis.

    Use this when the user asks to summarize, synthesize, combine notes and
    highlights, or draft takeaways for the current source. It returns recent
    highlights, user notes, existing takeaways, and section summaries without
    requiring query-based search.
    """

    source_id: int = Field(description="The source ID to load (must match the session source)")
    include: list[ContextKind] | None = Field(
        default=None,
        description=(
            "Content to include. Null includes citations, captures, takeaways, and sections."
        ),
    )
    limit_per_type: int = Field(
        default=20,
        ge=1,
        le=50,
        description="Maximum number of items to return per content type",
    )


@action(schema=GetSourceContextSchema)
class GetSourceContext:
    """Fetch source context without relying on semantic search."""

    def __init__(self, db: AsyncSession, user_id: str, hit_store: HitStore):
        self.db = db
        self.user_id = user_id
        self.hit_store = hit_store
        self._sources = SourceRepository()
        self._citations = CitationRepository()
        self._captures = CaptureRepository()
        self._takeaways = SourceTakeawayRepository()
        self._sections = SourceSectionRepository()

    async def __call__(
        self, params: GetSourceContextSchema, citation_start: int = 1
    ) -> ActionResult:
        try:
            include = set(params.include or ["citations", "captures", "takeaways", "sections"])
            logger.info(
                "[get_source_context] source_id=%s include=%s limit_per_type=%s",
                params.source_id,
                sorted(include),
                params.limit_per_type,
            )

            source = await self._sources.get_for_user(self.db, params.source_id, self.user_id)
            if source is None:
                return ActionResult(
                    content="No source found for this user.",
                    citations={},
                    summary="Source not found",
                    metadata={"stats": {"total": 0}},
                )

            hits: list[RetrievalHit] = []

            if "citations" in include:
                source_citations = await self._citations.list_for_source(
                    self.db, self.user_id, params.source_id, limit=params.limit_per_type
                )
                for citation in source_citations:
                    hits.append(
                        RetrievalHit(
                            kind="citation",
                            entity_id=citation.id,
                            text=citation.text,
                            source_id=source.id,
                            source_title=source.title,
                            source_type=source.type,
                            source_author=source.author,
                            source_label=source.label,
                            source_status=source.status,
                            source_published_at=source.published_at,
                            source_last_active_at=source.last_active_at,
                            score=1.0,
                        )
                    )

            if "captures" in include:
                source_captures = await self._captures.list_for_source_with_citations(
                    self.db, self.user_id, params.source_id, params.limit_per_type
                )
                for capture, capture_citation in source_captures:
                    hits.append(
                        RetrievalHit(
                            kind="capture",
                            entity_id=capture.id,
                            text=capture.content,
                            source_id=source.id,
                            source_title=source.title,
                            source_type=source.type,
                            source_author=source.author,
                            source_label=source.label,
                            source_status=source.status,
                            source_published_at=source.published_at,
                            source_last_active_at=source.last_active_at,
                            citation_id=capture_citation.id if capture_citation else None,
                            citation_text=capture_citation.text if capture_citation else None,
                            citation_speaker=(
                                capture_citation.speaker if capture_citation else None
                            ),
                            citation_context=(
                                capture_citation.context if capture_citation else None
                            ),
                            score=1.0,
                        )
                    )

            if "takeaways" in include:
                source_takeaways = await self._takeaways.list_by_source(
                    self.db,
                    params.source_id,
                    self.user_id,
                    newest_first=True,
                    limit=params.limit_per_type,
                )
                for takeaway in source_takeaways:
                    hits.append(
                        RetrievalHit(
                            kind="takeaway",
                            entity_id=takeaway.id,
                            text=f"{takeaway.title}\n{takeaway.body}",
                            source_id=source.id,
                            source_title=source.title,
                            source_type=source.type,
                            source_author=source.author,
                            source_label=source.label,
                            source_status=source.status,
                            source_published_at=source.published_at,
                            source_last_active_at=source.last_active_at,
                            takeaway_title=takeaway.title,
                            takeaway_body=takeaway.body,
                            score=1.0,
                        )
                    )

            if "sections" in include:
                source_sections = await self._sections.list_by_source_for_user(
                    self.db, params.source_id, self.user_id, limit=params.limit_per_type
                )
                for section in source_sections:
                    hits.append(
                        RetrievalHit(
                            kind="source_section_summary",
                            entity_id=section.id,
                            text=section.summary or section.title,
                            source_id=source.id,
                            source_title=source.title,
                            source_type=source.type,
                            source_author=source.author,
                            source_label=source.label,
                            source_status=source.status,
                            source_published_at=source.published_at,
                            source_last_active_at=source.last_active_at,
                            section_id=section.id,
                            section_title=section.title,
                            section_subtitle=section.subtitle,
                            section_summary=section.summary,
                            score=1.0,
                        )
                    )

            annotated_hits = self.hit_store.register_hits(hits, citation_start)
            citations = build_citations_from_hits(self.hit_store.all_hits_with_ids())
            content = format_hits_for_llm(annotated_hits)

            stats = {
                "total": len(hits),
                "citations": sum(1 for hit in hits if hit.kind == "citation"),
                "captures": sum(1 for hit in hits if hit.kind == "capture"),
                "takeaways": sum(1 for hit in hits if hit.kind == "takeaway"),
                "sections": sum(1 for hit in hits if hit.kind == "source_section_summary"),
            }
            summary = (
                f"Loaded {stats['total']} source item(s) "
                f"(citations={stats['citations']}, captures={stats['captures']}, "
                f"takeaways={stats['takeaways']}, sections={stats['sections']})"
            )

            return ActionResult(
                content=content,
                citations=citations,
                summary=summary,
                metadata={"stats": stats},
            )
        except Exception as e:
            logger.error("[get_source_context] failed: %s", e, exc_info=True)
            raise
