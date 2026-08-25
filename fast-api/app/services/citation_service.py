from __future__ import annotations

from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.datetime_utils import utcnow
from app.core.exceptions import AuthorizationError, ValidationError
from app.core.hashing import sha256_hex_or_none
from app.core.ownership import require_capture, require_citation, require_source
from app.models.database import Capture, Citation
from app.repositories.capture_repository import CaptureRepository
from app.repositories.citation_repository import CitationRepository
from app.repositories.source_repository import bump_source_last_active
from app.schemas.citation_location import CitationLocation
from app.schemas.citations import (
    LOCATION_ADAPTER,
    CapturesDelta,
    CitationResponse,
    CreateCaptureInput,
    CreateCitationRequest,
)
from app.services.citation_location_validation import (
    validate_citation_location,
    validate_section_ownership,
)
from app.services.citation_suggestion_approval import approve_citation_suggestion
from app.services.source_lifecycle import maybe_start_source
from app.services.source_list_cache import invalidate_source_list_cache

_citation_repo = CitationRepository()
_capture_repo = CaptureRepository()


def _location_to_json(location: CitationLocation | None) -> dict[str, Any] | None:
    if location is None:
        return None
    # by_alias keeps the on-disk JSON shape (`pageStart`, `tStartSec`, …)
    # consistent with rows written before the Python migration.
    return location.model_dump(by_alias=True, exclude_none=True)


class CitationService:
    # ----- Create -----

    async def create(
        self,
        *,
        db: AsyncSession,
        user_id: str,
        req: CreateCitationRequest,
    ) -> tuple[Citation, list[Capture], bool]:
        """Create a citation (and any number of captures) directly or from a
        suggestion.

        Returns (citation, captures, source_started). `source_started` is True
        if the citation's source auto-transitioned todo → in_progress.
        """
        if req.suggestion_id is not None:
            citation, captures = await approve_citation_suggestion(db=db, user_id=user_id, req=req)
        else:
            citation, captures = await self._create_direct(db=db, user_id=user_id, req=req)

        source_started = False
        if citation.source_id is not None:
            source_started = await maybe_start_source(
                db, source_id=citation.source_id, user_id=user_id
            )
            if not source_started:
                await invalidate_source_list_cache(user_id)

        return citation, captures, source_started

    async def _create_direct(
        self,
        *,
        db: AsyncSession,
        user_id: str,
        req: CreateCitationRequest,
    ) -> tuple[Citation, list[Capture]]:
        await validate_citation_location(
            db, location=req.location, source_id=req.source_id, user_id=user_id
        )
        if req.section_id is not None:
            if req.source_id is None:
                raise ValidationError("section_id requires source_id to be set")
            await validate_section_ownership(
                db, section_id=req.section_id, source_id=req.source_id, user_id=user_id
            )

        now = utcnow()
        citation = await _citation_repo.create(
            db,
            Citation(
                user_id=user_id,
                info_type=req.info_type,
                text=req.text.strip(),
                summary=req.summary,
                source_id=req.source_id,
                section_id=req.section_id,
                location=_location_to_json(req.location),
                text_sha256=sha256_hex_or_none(req.text),
                speaker=req.speaker,
                context=req.context,
                created_at=now,
                updated_at=now,
            ),
        )

        captures: list[Capture] = []
        for inp in req.captures:
            # Inherit source and section from the citation so paired notes show
            # up in section-scoped capture views.
            captures.append(
                await self._create_capture(
                    db=db,
                    user_id=user_id,
                    inp=inp,
                    citation_id=citation.id,
                    source_id=req.source_id,
                    section_id=req.section_id,
                )
            )

        return citation, captures

    async def _create_capture(
        self,
        *,
        db: AsyncSession,
        user_id: str,
        inp: CreateCaptureInput,
        citation_id: int,
        source_id: int | None,
        section_id: int | None = None,
    ) -> Capture:
        now = utcnow()
        return await _capture_repo.create(
            db,
            Capture(
                user_id=user_id,
                citation_id=citation_id,
                source_id=source_id,
                section_id=section_id,
                content=inp.text.strip(),
                summary=inp.summary,
                content_sha256=sha256_hex_or_none(inp.text),
                created_at=now,
                updated_at=now,
            ),
        )

    # ----- Update -----

    async def assign_section(
        self,
        *,
        db: AsyncSession,
        user_id: str,
        citation_id: int,
        source_id: int,
        section_id: int | None,
    ) -> Citation:
        """Move a citation to a section (or back to source-unsectioned when
        section_id is None).

        - Citation must belong to the supplied source.
        - When section_id is non-null, the section must belong to the source.
        """
        citation = await require_citation(db, citation_id, user_id)
        await require_source(db, source_id, user_id)

        if citation.source_id != source_id:
            raise AuthorizationError("citation does not belong to the supplied source")

        if section_id is not None:
            await validate_section_ownership(
                db, section_id=section_id, source_id=source_id, user_id=user_id
            )

        citation.section_id = section_id
        citation.updated_at = utcnow()
        await db.flush()
        await db.refresh(citation)
        return citation

    async def update(
        self,
        *,
        db: AsyncSession,
        user_id: str,
        citation_id: int,
        info_type: str | None = None,
        text: str | None = None,
        summary: str | None = None,
        source_id: int | None = None,
        section_id: int | None = None,
        location: CitationLocation | None = None,
        speaker: str | None = None,
        context: str | None = None,
        # When True the caller asked to clear the optional field; when False
        # an absent field is preserved. None means "use the new value verbatim".
        clear_summary: bool = False,
        clear_speaker: bool = False,
        clear_context: bool = False,
        clear_section: bool = False,
    ) -> tuple[Citation, bool]:
        """Returns (citation, doc_affecting). When doc_affecting is True the
        embedding for the citation needs to be regenerated."""
        citation = await require_citation(db, citation_id, user_id)

        # Resolve effective source_id/section_id post-merge so validators see
        # the post-write state.
        effective_source_id = source_id if source_id is not None else citation.source_id
        effective_section_id: int | None
        if section_id is not None:
            effective_section_id = section_id
        elif clear_section:
            effective_section_id = None
        else:
            effective_section_id = citation.section_id

        # Location validation runs against the (possibly new) source.
        # Three cases:
        #   - new location provided → validate it
        #   - source_id changing while a location already exists → revalidate
        #     existing against the new source (incompatible source types would
        #     otherwise leave an invalid location persisted)
        #   - neither → skip
        if location is not None:
            await validate_citation_location(
                db,
                location=location,
                source_id=effective_source_id,
                user_id=user_id,
            )
        elif source_id is not None and source_id != citation.source_id and citation.location:
            existing_loc = LOCATION_ADAPTER.validate_python(citation.location)
            await validate_citation_location(
                db,
                location=existing_loc,
                source_id=effective_source_id,
                user_id=user_id,
            )
        if effective_section_id is not None:
            if effective_source_id is None:
                raise ValidationError("section_id requires source_id to be set")
            await validate_section_ownership(
                db,
                section_id=effective_section_id,
                source_id=effective_source_id,
                user_id=user_id,
            )

        if info_type is not None:
            citation.info_type = info_type  # type: ignore[assignment]
        if text is not None:
            stripped = text.strip()
            citation.text = stripped
            citation.text_sha256 = sha256_hex_or_none(stripped)
        if summary is not None:
            citation.summary = summary
        elif clear_summary:
            citation.summary = None
        if source_id is not None:
            citation.source_id = source_id
        if section_id is not None:
            citation.section_id = section_id
        elif clear_section:
            citation.section_id = None
        if location is not None:
            citation.location = _location_to_json(location)
        if speaker is not None:
            citation.speaker = speaker
        elif clear_speaker:
            citation.speaker = None
        if context is not None:
            citation.context = context
        elif clear_context:
            citation.context = None
        citation.updated_at = utcnow()

        if citation.source_id is not None:
            await bump_source_last_active(db, citation.source_id, user_id)
            await invalidate_source_list_cache(user_id)

        doc_affecting = (
            text is not None
            or speaker is not None
            or clear_speaker
            or context is not None
            or clear_context
            or source_id is not None
        )

        return citation, doc_affecting

    async def apply_captures_delta(
        self,
        *,
        db: AsyncSession,
        user_id: str,
        citation: Citation,
        delta: CapturesDelta,
    ) -> list[Capture]:
        """Apply a create/update/delete set to a citation's captures in the
        caller's transaction.

        Ownership of each updated/deleted capture is verified against user_id.
        Returns the captures whose embeddings need regenerating (every created
        capture plus updates whose text actually changed); deleted captures are
        not returned.
        """
        needs_embedding: list[Capture] = []

        for inp in delta.create:
            needs_embedding.append(
                await self._create_capture(
                    db=db,
                    user_id=user_id,
                    inp=CreateCaptureInput(text=inp.text, summary=inp.summary),
                    citation_id=citation.id,
                    source_id=citation.source_id,
                    section_id=citation.section_id,
                )
            )

        for upd in delta.update:
            capture = await require_capture(db, upd.id, user_id)
            if capture.citation_id != citation.id:
                raise AuthorizationError("capture does not belong to the supplied citation")
            stripped = upd.text.strip()
            text_changed = capture.content != stripped
            capture.content = stripped
            capture.content_sha256 = sha256_hex_or_none(stripped)
            # Only touch summary when the client actually sent it; a text-only
            # edit (the common dialog case) omits the field and must preserve
            # the existing summary rather than clearing it to None.
            if "summary" in upd.model_fields_set:
                capture.summary = upd.summary
            capture.updated_at = utcnow()
            if text_changed:
                needs_embedding.append(capture)

        for capture_id in delta.delete:
            capture = await require_capture(db, capture_id, user_id)
            if capture.citation_id != citation.id:
                raise AuthorizationError("capture does not belong to the supplied citation")
            await _capture_repo.soft_delete(db, capture=capture)
            await _capture_repo.unlink_from_takeaways(db, capture_id=capture.id)

        if delta.create or delta.update or delta.delete:
            await db.flush()

        return needs_embedding

    # ----- Delete -----

    async def delete(self, *, db: AsyncSession, user_id: str, citation_id: int) -> None:
        citation = await require_citation(db, citation_id, user_id)
        source_id = citation.source_id

        # Embedding row references citation_id with a UNIQUE constraint;
        # purge it explicitly so the FK doesn't block deletion.
        await _citation_repo.delete_embedding(db, citation_id)
        # Captures attached to the citation get unlinked (citation_id is nullable);
        # we do not cascade-delete captures.
        await _citation_repo.unlink_captures(db, citation_id)
        await _citation_repo.delete_by_id(db, citation_id)

        if source_id is not None:
            await bump_source_last_active(db, source_id, user_id)
            await invalidate_source_list_cache(user_id)

    # ----- Reads -----

    async def _attach_captures(
        self, db: AsyncSession, citations: list[Citation]
    ) -> list[CitationResponse]:
        """Build responses with every non-deleted capture grouped onto its
        citation (batched, no N+1)."""
        captures_by_citation = await _capture_repo.list_active_by_citation_ids(
            db, [c.id for c in citations]
        )
        return [
            CitationResponse.from_orm_with_captures(c, captures_by_citation.get(c.id, []))
            for c in citations
        ]

    async def to_response_with_captures(
        self, *, db: AsyncSession, citation: Citation
    ) -> CitationResponse:
        """Build a single CitationResponse with its non-deleted captures
        attached. For callers that already hold an authorized ORM citation
        (e.g. after an update)."""
        responses = await self._attach_captures(db, [citation])
        return responses[0]

    async def get(self, *, db: AsyncSession, user_id: str, citation_id: int) -> CitationResponse:
        citation = await require_citation(db, citation_id, user_id)
        responses = await self._attach_captures(db, [citation])
        return responses[0]

    async def list_for_user(self, *, db: AsyncSession, user_id: str) -> list[CitationResponse]:
        citations = await _citation_repo.list_for_user(db, user_id)
        return await self._attach_captures(db, citations)

    async def list_unsorted(self, *, db: AsyncSession, user_id: str) -> list[CitationResponse]:
        citations = await _citation_repo.list_unsorted(db, user_id)
        return await self._attach_captures(db, citations)

    async def list_for_source(
        self, *, db: AsyncSession, user_id: str, source_id: int
    ) -> list[CitationResponse]:
        await require_source(db, source_id, user_id)
        citations = await _citation_repo.list_for_source(db, user_id, source_id, limit=None)
        return await self._attach_captures(db, citations)
