"""Suggest citations without captures for the reflection agent."""

from jetflow import ActionResult, action
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.repositories.citation_repository import CitationRepository

logger = get_logger(__name__)

MAX_SUGGESTIONS = 5


class SuggestUncapturedCitationsSchema(BaseModel):
    """Find citations from this source that have no notes yet.

    Call this at the start of a reflection session to surface highlights the
    user has not yet reflected on. Returns up to 5 citations without any
    linked captures.
    """

    source_id: int = Field(description="The source ID to check (must match the session source)")


@action(schema=SuggestUncapturedCitationsSchema)
class SuggestUncapturedCitations:
    """Fetch citations with zero captures so the agent can surface them."""

    def __init__(self, db: AsyncSession, user_id: str):
        self.db = db
        self.user_id = user_id
        self._citations = CitationRepository()

    async def __call__(
        self, params: SuggestUncapturedCitationsSchema, citation_start: int = 1
    ) -> ActionResult:
        try:
            logger.info(
                f"[suggest_uncaptured_citations] source_id={params.source_id}, user={self.user_id}"
            )

            # Citations for this source that have no linked captures (not deleted)
            rows = await self._citations.list_uncaptured_for_source(
                self.db, self.user_id, params.source_id, MAX_SUGGESTIONS
            )

            if not rows:
                return ActionResult(
                    content="All citations for this source already have notes attached.",
                    summary="No uncaptured citations found",
                    metadata={"stats": {"total": 0, "citations": 0}},
                )

            # Build content string for the LLM to reason over
            lines: list[str] = []
            suggestions: list[dict] = []

            for citation, source_title in rows:
                lines.append(
                    f'- [citation:{citation.id}] "{citation.text[:200]}'
                    f"{'...' if len(citation.text) > 200 else ''}\""
                )
                suggestions.append(
                    {
                        "citation_id": citation.id,
                        "citation_text": citation.text,
                        "source_id": params.source_id,
                        "source_title": source_title,
                        "speaker": citation.speaker,
                        "context": citation.context,
                    }
                )

            content = (
                f"Found {len(rows)} citation(s) without notes:\n\n"
                + "\n".join(lines)
                + "\n\nFor each citation above, suggest a short, probing question "
                "to help the user reflect — e.g. 'Is this why...?', 'Do you agree that...?', "
                "'What does this mean for...?'. Keep each probe to one sentence."
            )

            return ActionResult(
                content=content,
                summary=f"Found {len(rows)} citation(s) without notes",
                metadata={
                    "suggestions": suggestions,
                    "stats": {"total": len(rows), "citations": len(rows)},
                },
            )
        except Exception as e:
            logger.error("[suggest_uncaptured_citations] failed: %s", e, exc_info=True)
            raise
