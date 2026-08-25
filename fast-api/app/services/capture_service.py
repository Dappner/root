"""Capture service — owns capture validation and lifecycle side effects.

Embedding generation is handled by the route layer via FastAPI BackgroundTasks
after the response is sent.
"""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.datetime_utils import utcnow
from app.core.exceptions import AuthorizationError, NotFoundError, ValidationError
from app.core.hashing import sha256_hex_or_none
from app.core.ownership import require_source
from app.models.database import Capture, SourceSection
from app.repositories.capture_repository import CaptureRepository
from app.services.source_lifecycle import maybe_start_source
from app.services.source_list_cache import invalidate_source_list_cache


class CaptureService:
    def __init__(self) -> None:
        self._repo = CaptureRepository()

    async def create(
        self,
        *,
        db: AsyncSession,
        user_id: str,
        text: str,
        citation_id: int | None,
        source_id: int | None,
        section_id: int | None,
        summary: str | None,
    ) -> tuple[Capture, bool]:
        """Create a capture. Returns (capture, source_started).

        `source_started` is True when this create triggered a todo→in_progress
        transition on the attached source. Always False when no source_id.
        """
        await self._validate_attachment(
            db=db,
            user_id=user_id,
            source_id=source_id,
            section_id=section_id,
        )

        now = utcnow()
        capture = Capture(
            user_id=user_id,
            citation_id=citation_id,
            source_id=source_id,
            section_id=section_id,
            content=text,
            summary=summary,
            content_sha256=sha256_hex_or_none(text),
            created_at=now,
            updated_at=now,
        )
        created = await self._repo.create(db, capture)

        source_started = False
        if source_id is not None:
            source_started = await maybe_start_source(db, source_id=source_id, user_id=user_id)
            if not source_started:
                await invalidate_source_list_cache(user_id)

        await db.flush()
        await db.refresh(created)

        return created, source_started

    async def get(
        self,
        *,
        db: AsyncSession,
        user_id: str,
        capture_id: int,
    ) -> Capture:
        capture = await self._repo.get(db, capture_id=capture_id, user_id=user_id)
        if capture is None:
            raise NotFoundError("capture not found")
        return capture

    async def list_for_source(
        self, *, db: AsyncSession, user_id: str, source_id: int
    ) -> list[Capture]:
        # Verify source ownership before reading captures — 404 if the source
        # doesn't exist or doesn't belong to the user.
        await require_source(db, source_id, user_id)
        return await self._repo.list_for_source(db, user_id, source_id, limit=10_000)

    async def update(
        self,
        *,
        db: AsyncSession,
        user_id: str,
        capture_id: int,
        text: str,
        citation_id: int | None,
        source_id: int | None,
        summary: str | None,
    ) -> Capture:
        """Full-replace PUT semantics.

        `section_id` is intentionally NOT touched by this method — the update
        request DTO has no section_id field. Section moves go through the
        sections/assign endpoint instead.
        """
        capture = await self.get(db=db, user_id=user_id, capture_id=capture_id)
        previous_source_id = capture.source_id

        # Validate the new attachment using the existing section_id (preserved).
        await self._validate_attachment(
            db=db,
            user_id=user_id,
            source_id=source_id,
            section_id=capture.section_id,
        )

        capture.content = text
        capture.content_sha256 = sha256_hex_or_none(text)
        capture.summary = summary
        capture.source_id = source_id
        capture.citation_id = citation_id
        capture.updated_at = utcnow()

        await db.flush()
        await db.refresh(capture)
        if previous_source_id is not None or source_id is not None:
            await invalidate_source_list_cache(user_id)

        return capture

    async def assign_section(
        self,
        *,
        db: AsyncSession,
        user_id: str,
        capture_id: int,
        source_id: int,
        section_id: int | None,
    ) -> Capture:
        """Move a capture to a section (or back to source-unsectioned when
        section_id is None).

        - Capture must belong to the supplied source.
        - When section_id is non-null, the section must belong to the source.
        """
        capture = await self.get(db=db, user_id=user_id, capture_id=capture_id)

        if capture.source_id != source_id:
            raise AuthorizationError("capture does not belong to the supplied source")

        if section_id is not None:
            await require_source(db, source_id, user_id)
            section = await db.get(SourceSection, section_id)
            if section is None:
                raise NotFoundError("section not found")
            if section.source_id != source_id:
                raise AuthorizationError(
                    f"section {section_id} does not belong to source {source_id}"
                )

        capture.section_id = section_id
        capture.updated_at = utcnow()
        await db.flush()
        await db.refresh(capture)
        return capture

    async def delete(
        self,
        *,
        db: AsyncSession,
        user_id: str,
        capture_id: int,
    ) -> None:
        capture = await self.get(db=db, user_id=user_id, capture_id=capture_id)
        source_id = capture.source_id
        await self._repo.soft_delete(db, capture=capture)
        # Soft-deleted captures should stop appearing in takeaway responses.
        # Reads filter `deleted_at IS NULL` defensively, but we also drop the
        # link rows so any code path that doesn't join Capture stays correct.
        await self._repo.unlink_from_takeaways(db, capture_id=capture.id)
        if source_id is not None:
            await invalidate_source_list_cache(user_id)

    async def _validate_attachment(
        self,
        *,
        db: AsyncSession,
        user_id: str,
        source_id: int | None,
        section_id: int | None,
    ) -> None:
        """Validate the capture's source/section attachment.

        - section_id requires source_id.
        - When source_id is set, the source must exist and be owned by the user.
        - When section_id is set, the section must belong to the same source.
        """
        if section_id is not None and source_id is None:
            raise ValidationError("section_id requires source_id")

        if source_id is None:
            return

        source = await require_source(db, source_id, user_id)

        if section_id is None:
            return

        section = await db.get(SourceSection, section_id)
        if section is None:
            raise NotFoundError("section not found")
        if section.source_id != source.id:
            raise ValidationError(f"section {section_id} does not belong to source {source_id}")
