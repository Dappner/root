"""Non-mutating suggestion actions for the contextual assistant."""

from typing import Literal

from jetflow import ActionResult, action
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.repositories.capture_repository import CaptureRepository
from app.repositories.citation_repository import CitationRepository

logger = get_logger(__name__)

Confidence = Literal["low", "medium", "high"]


class SuggestCreateCaptureSchema(BaseModel):
    """Suggest a user note/capture for review.

    Use this when the user asks you to save, capture, remember, attach, or turn
    their thought into a note. This tool does not write to the database; it only
    returns a reviewable suggestion for the frontend.
    """

    source_id: int = Field(description="Source ID for the suggested note")
    text: str = Field(min_length=1, max_length=4000, description="Suggested note text")
    section_id: int | None = Field(default=None, description="Optional section ID")
    citation_id: int | None = Field(
        default=None,
        description="Optional citation ID when the note clearly attaches to a quote",
    )
    confidence: Confidence = Field(default="medium")
    rationale: str | None = Field(default=None, max_length=1000)


class SuggestUpdateSectionSummarySchema(BaseModel):
    """Suggest an updated source section summary for review.

    Use this when the user asks for a chapter/section summary or asks you to
    update/refine the current section summary. This tool does not write to the
    database; it only returns a reviewable suggestion for the frontend.
    """

    source_id: int = Field(description="Source ID for the section")
    section_id: int = Field(description="Section ID to update")
    summary: str = Field(
        min_length=1,
        max_length=4000,
        description=(
            "Suggested summary body only. Do not include the section/chapter title, "
            "section ID, bullets, quotation marks, or labels like 'Suggested summary'."
        ),
    )
    confidence: Confidence = Field(default="medium")
    rationale: str | None = Field(default=None, max_length=1000)


class SuggestCreateTakeawaySchema(BaseModel):
    """Suggest a source takeaway for review.

    Use this when the user asks you to synthesize, distill, create, save, or
    draft a takeaway from a source. This tool does not write to the database;
    it only returns a reviewable suggestion for the frontend.
    """

    source_id: int = Field(description="Source ID for the suggested takeaway")
    title: str = Field(
        min_length=1,
        max_length=255,
        description="Concise takeaway title. Do not include labels like 'Takeaway'.",
    )
    body: str = Field(
        default="",
        max_length=4000,
        description="Takeaway body explaining the insight in the user's voice.",
    )
    citation_ids: list[int] = Field(
        default_factory=list,
        description="Citation IDs that support this takeaway.",
    )
    capture_ids: list[int] = Field(
        default_factory=list,
        description="Capture/note IDs that support this takeaway.",
    )
    confidence: Confidence = Field(default="medium")
    rationale: str | None = Field(default=None, max_length=1000)


class SuggestCreateCitationSchema(BaseModel):
    """Suggest saving a transcript excerpt or quote as a citation for review.

    Use this when the user wants to save, highlight, or bookmark something from
    a transcript chunk. This tool does not write to the database; it only returns
    a reviewable suggestion for the frontend.

    Always include t_start_sec and t_end_sec when creating from a transcript_chunk
    so the citation links back to the correct timestamp in the audio player.
    """

    source_id: int = Field(description="Source ID the citation belongs to")
    text: str = Field(min_length=1, max_length=4000, description="The exact quote or excerpt text")
    speaker: str | None = Field(
        default=None, description="Speaker name, if known (e.g. from transcript metadata)"
    )
    context: str | None = Field(
        default=None,
        max_length=500,
        description="Brief context for what was being discussed",
    )
    t_start_sec: float | None = Field(
        default=None, description="Timestamp start in seconds (from chunk_start)"
    )
    t_end_sec: float | None = Field(
        default=None, description="Timestamp end in seconds (from chunk_end)"
    )
    chunk_index: int | None = Field(
        default=None, description="Chunk index from the transcript (from chunk_index)"
    )
    confidence: Confidence = Field(default="medium")
    rationale: str | None = Field(default=None, max_length=1000)


@action(schema=SuggestCreateCitationSchema)
class SuggestCreateCitation:
    """Create a structured suggestion to save text as a citation/highlight."""

    async def __call__(self, params: SuggestCreateCitationSchema) -> ActionResult:
        suggestion = {
            "type": "create_citation",
            "source_id": params.source_id,
            "text": params.text,
            "speaker": params.speaker,
            "context": params.context,
            "t_start_sec": params.t_start_sec,
            "t_end_sec": params.t_end_sec,
            "chunk_index": params.chunk_index,
            "confidence": params.confidence,
            "rationale": params.rationale,
        }
        speaker_note = f" by {params.speaker}" if params.speaker else ""
        return ActionResult(
            content=(
                "Suggested saving this excerpt as a citation for frontend review. "
                "Do not say it has been saved yet."
            ),
            summary=f"Suggested citation{speaker_note}",
            metadata={"suggestion": suggestion},
        )


@action(schema=SuggestCreateCaptureSchema)
class SuggestCreateCapture:
    """Create a structured suggestion to add a note/capture."""

    async def __call__(self, params: SuggestCreateCaptureSchema) -> ActionResult:
        suggestion = {
            "type": "create_capture",
            "source_id": params.source_id,
            "section_id": params.section_id,
            "citation_id": params.citation_id,
            "text": params.text,
            "confidence": params.confidence,
            "rationale": params.rationale,
        }
        link = f" linked to citation {params.citation_id}" if params.citation_id else ""
        return ActionResult(
            content=(
                "Suggested creating a note for frontend review. "
                "Do not say it has been saved yet."
            ),
            summary=f"Suggested note{link}",
            metadata={"suggestion": suggestion},
        )


@action(schema=SuggestUpdateSectionSummarySchema)
class SuggestUpdateSectionSummary:
    """Create a structured suggestion to update a section summary."""

    async def __call__(self, params: SuggestUpdateSectionSummarySchema) -> ActionResult:
        suggestion = {
            "type": "update_section_summary",
            "source_id": params.source_id,
            "section_id": params.section_id,
            "summary": params.summary,
            "confidence": params.confidence,
            "rationale": params.rationale,
        }
        return ActionResult(
            content=(
                "The frontend rendered the section summary suggestion card. "
                "Do not restate the suggested summary in your final answer."
            ),
            summary="Suggested section summary update",
            metadata={"suggestion": suggestion},
        )


@action(schema=SuggestCreateTakeawaySchema)
class SuggestCreateTakeaway:
    """Create a structured suggestion to add a source takeaway."""

    def __init__(self, db: AsyncSession, user_id: str) -> None:
        self.db = db
        self.user_id = user_id
        self._citations = CitationRepository()
        self._captures = CaptureRepository()

    async def _validate_ids(
        self, source_id: int, citation_ids: list[int], capture_ids: list[int]
    ) -> tuple[list[int], list[int]]:
        """Strip any IDs that don't belong to this source/user."""
        valid_citations: list[int] = []
        if citation_ids:
            valid_citations = await self._citations.validate_ids_for_source(
                self.db, self.user_id, source_id, citation_ids
            )
            invalid = set(citation_ids) - set(valid_citations)
            if invalid:
                logger.warning(
                    "SuggestCreateTakeaway: stripped invalid citation_ids %s for source %s",
                    invalid,
                    source_id,
                )

        valid_captures: list[int] = []
        if capture_ids:
            valid_captures = await self._captures.validate_ids_for_source(
                self.db, self.user_id, source_id, capture_ids
            )
            invalid = set(capture_ids) - set(valid_captures)
            if invalid:
                logger.warning(
                    "SuggestCreateTakeaway: stripped invalid capture_ids %s for source %s",
                    invalid,
                    source_id,
                )

        return valid_citations, valid_captures

    async def __call__(self, params: SuggestCreateTakeawaySchema) -> ActionResult:
        citation_ids, capture_ids = await self._validate_ids(
            params.source_id, params.citation_ids, params.capture_ids
        )
        suggestion = {
            "type": "create_takeaway",
            "source_id": params.source_id,
            "title": params.title,
            "body": params.body,
            "citation_ids": citation_ids,
            "capture_ids": capture_ids,
            "confidence": params.confidence,
            "rationale": params.rationale,
        }
        return ActionResult(
            content=(
                "The frontend rendered the takeaway suggestion card. "
                "Do not restate the full suggested takeaway in your final answer."
            ),
            summary="Suggested source takeaway",
            metadata={"suggestion": suggestion},
        )
