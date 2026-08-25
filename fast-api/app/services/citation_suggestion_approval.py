from __future__ import annotations

from sqlalchemy.exc import NoResultFound
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ValidationError
from app.models.database import Capture, Citation
from app.repositories.capture_repository import CaptureRepository
from app.repositories.citation_repository import CitationRepository
from app.schemas.citation_location import TranscriptLocation as CitationTranscriptLocation
from app.schemas.citations import CreateCitationRequest
from app.schemas.suggestions import (
    SuggestedCapturePayload,
    SuggestedCitationPayload,
    SuggestedPayload,
    SuggestedPayloadEntities,
)
from app.schemas.suggestions import (
    TranscriptLocation as SuggestionTranscriptLocation,
)
from app.services.citation_location_validation import validate_section_ownership
from app.services.suggestion_service import SuggestionService


def _suggestion_location(req: CreateCitationRequest) -> SuggestionTranscriptLocation:
    if req.location is None:
        raise ValidationError("suggestion citations require a location")
    if not isinstance(req.location, CitationTranscriptLocation):
        raise ValidationError("suggestion citations require a transcript_v1 location")
    return SuggestionTranscriptLocation.model_validate(req.location.model_dump(by_alias=True))


def _payload_override(req: CreateCitationRequest) -> SuggestedPayload:
    citation = SuggestedCitationPayload(
        text=req.text.strip(),
        info_type=req.info_type,
        location=_suggestion_location(req),
        speaker=req.speaker,
        context=req.context,
        summary=req.summary,
        section_id=req.section_id,
    )

    captures: list[SuggestedCapturePayload] = [
        SuggestedCapturePayload(
            text=inp.text,
            citation_idx=0,
        )
        for inp in req.captures
    ]

    return SuggestedPayloadEntities(
        action="create_entities",
        confidence=1.0,
        voice_transcript="",
        reasoning_summary="",
        citations=[citation],
        captures=captures,
    )


async def approve_citation_suggestion(
    *,
    db: AsyncSession,
    user_id: str,
    req: CreateCitationRequest,
) -> tuple[Citation, list[Capture]]:
    """Approve a suggestion using user edits from the citation create request."""
    if req.suggestion_id is None:
        raise ValidationError("suggestion_id is required")

    # No embedding service: the calling CitationService.create() schedules
    # embeddings after this returns, so passing one here would double-schedule.
    service = SuggestionService()

    # SuggestionService.approve writes section_id directly without checking
    # that the section belongs to the suggestion's source; verify here.
    if req.section_id is not None:
        suggestion = await service.get(db=db, user_id=user_id, suggestion_id=req.suggestion_id)
        if suggestion.source_id is None:
            raise ValidationError("cannot attach section_id: suggestion has no source")
        await validate_section_ownership(
            db,
            section_id=req.section_id,
            source_id=suggestion.source_id,
            user_id=user_id,
        )

    _, citation_ids, capture_ids = await service.approve(
        db=db,
        user_id=user_id,
        suggestion_id=req.suggestion_id,
        payload_override=_payload_override(req),
    )

    if not citation_ids:
        raise ValidationError("expected citation to be created from suggestion approval")
    citation_id = citation_ids[0]
    citation = await CitationRepository().get_by_id(db, citation_id)
    if citation is None:
        raise NoResultFound("No row was found when one was required")

    captures: list[Capture] = []
    if capture_ids:
        rows = await CaptureRepository().list_by_ids(db, capture_ids)
        # Preserve the order the suggestion approval created them in.
        by_id = {row.id: row for row in rows}
        captures = [by_id[cid] for cid in capture_ids if cid in by_id]

    return citation, captures
