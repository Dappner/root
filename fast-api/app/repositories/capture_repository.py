"""Capture repository — query bundle, stateless.

Repositories return ORM objects; services own validation and side effects.
Every read filters `deleted_at IS NULL`; deletes are soft.
"""

from __future__ import annotations

from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.datetime_utils import utcnow
from app.models.database import Capture, Citation, SourceTakeawayCapture

MAX_CONTEXT_ITEMS = 50


class CaptureRepository:
    async def create(self, db: AsyncSession, capture: Capture) -> Capture:
        db.add(capture)
        await db.flush()
        return capture

    async def get(
        self,
        db: AsyncSession,
        *,
        capture_id: int,
        user_id: str,
    ) -> Capture | None:
        stmt = select(Capture).where(
            Capture.id == capture_id,
            Capture.user_id == user_id,
            Capture.deleted_at.is_(None),
        )
        return (await db.execute(stmt)).scalar_one_or_none()

    async def list_by_ids(self, db: AsyncSession, capture_ids: list[int]) -> list[Capture]:
        """Fetch captures by id with no soft-delete filter. Used for post-create
        re-fetch where the rows were just inserted in the same transaction."""
        if not capture_ids:
            return []
        result = await db.execute(select(Capture).where(Capture.id.in_(capture_ids)))
        return list(result.scalars())

    async def list_for_source(
        self,
        db: AsyncSession,
        user_id: str,
        source_id: int,
        section_id: int | None = None,
        limit: int = MAX_CONTEXT_ITEMS,
    ) -> list[Capture]:
        stmt = (
            select(Capture)
            .where(
                Capture.user_id == user_id,
                Capture.source_id == source_id,
                Capture.deleted_at.is_(None),
            )
            .order_by(Capture.created_at.desc())
            .limit(limit)
        )
        if section_id is not None:
            stmt = stmt.where(Capture.section_id == section_id)
        result = await db.execute(stmt)
        return list(result.scalars())

    async def list_for_source_with_citations(
        self,
        db: AsyncSession,
        user_id: str,
        source_id: int,
        limit: int,
    ) -> list[tuple[Capture, Citation | None]]:
        """Active captures for a source, each paired with its linked citation
        (or None). Newest first, capped at `limit`."""
        stmt = (
            select(Capture, Citation)
            .outerjoin(Citation, Capture.citation_id == Citation.id)
            .where(
                Capture.user_id == user_id,
                Capture.source_id == source_id,
                Capture.deleted_at.is_(None),
            )
            .order_by(Capture.created_at.desc())
            .limit(limit)
        )
        result = await db.execute(stmt)
        return [(row[0], row[1]) for row in result.all()]

    async def validate_ids_for_source(
        self,
        db: AsyncSession,
        user_id: str,
        source_id: int,
        capture_ids: list[int],
    ) -> list[int]:
        """Subset of `capture_ids` that exist, are active, belong to the user,
        and live in the given source."""
        if not capture_ids:
            return []
        result = await db.execute(
            select(Capture.id).where(
                Capture.id.in_(capture_ids),
                Capture.source_id == source_id,
                Capture.user_id == user_id,
                Capture.deleted_at.is_(None),
            )
        )
        return list(result.scalars())

    async def list_citation_section_pairs(
        self, db: AsyncSession, source_id: int
    ) -> list[tuple[int, int | None, int]]:
        """For captures in a source whose linked citation has a section, return
        `(capture_id, capture_section_id, citation_section_id)` — used to make
        captures inherit their citation's section during backfill."""
        result = await db.execute(
            select(
                Capture.id,
                Capture.section_id,
                Citation.section_id,
            )
            .join(Citation, Capture.citation_id == Citation.id)
            .where(
                Capture.source_id == source_id,
                Citation.section_id.is_not(None),
            )
        )
        return [(row[0], row[1], row[2]) for row in result.all()]

    async def assign_section(
        self, db: AsyncSession, capture_ids: list[int], section_id: int
    ) -> None:
        """Bulk-set `section_id` on the given captures."""
        if not capture_ids:
            return
        await db.execute(
            update(Capture)
            .where(Capture.id.in_(capture_ids))
            .values(section_id=section_id, updated_at=utcnow())
        )

    async def list_active_by_citation_ids(
        self,
        db: AsyncSession,
        citation_ids: list[int],
    ) -> dict[int, list[Capture]]:
        """Batch-load non-deleted captures grouped by citation_id.

        Returns a map citation_id -> captures (oldest first) for the supplied
        citation ids. Citations with no captures are absent from the map.
        Used by citation read paths to attach all captures per citation without
        an N+1 query.
        """
        if not citation_ids:
            return {}
        stmt = (
            select(Capture)
            .where(
                Capture.citation_id.in_(citation_ids),
                Capture.deleted_at.is_(None),
            )
            .order_by(Capture.created_at.asc(), Capture.id.asc())
        )
        result = await db.execute(stmt)
        grouped: dict[int, list[Capture]] = {}
        for capture in result.scalars():
            if capture.citation_id is None:
                continue
            grouped.setdefault(capture.citation_id, []).append(capture)
        return grouped

    async def soft_delete(
        self,
        db: AsyncSession,
        *,
        capture: Capture,
    ) -> None:
        now = utcnow()
        capture.deleted_at = now
        capture.updated_at = now
        await db.flush()

    async def unlink_from_takeaways(self, db: AsyncSession, capture_id: int) -> None:
        """Drop every source_takeaway_captures link row that points at this
        capture. Called from CaptureService.delete so soft-deleted captures
        stop appearing in takeaway responses; the takeaways themselves are
        not touched."""
        await db.execute(
            delete(SourceTakeawayCapture).where(SourceTakeawayCapture.capture_id == capture_id)
        )
        await db.flush()
