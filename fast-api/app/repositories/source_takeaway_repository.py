from __future__ import annotations

from datetime import datetime

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.database import (
    Capture,
    Citation,
    PodcastEpisode,
    Source,
    SourceTakeaway,
    SourceTakeawayCapture,
    SourceTakeawayCitation,
    Video,
)


class SourceTakeawayRepository:
    # --- Takeaway CRUD ---

    async def get(self, db: AsyncSession, takeaway_id: int, user_id: str) -> SourceTakeaway | None:
        result = await db.execute(
            select(SourceTakeaway).where(
                SourceTakeaway.id == takeaway_id,
                SourceTakeaway.user_id == user_id,
            )
        )
        return result.scalar_one_or_none()

    async def list_by_source(
        self,
        db: AsyncSession,
        source_id: int,
        user_id: str,
        *,
        newest_first: bool = False,
        limit: int | None = None,
    ) -> list[SourceTakeaway]:
        order = (
            SourceTakeaway.created_at.desc() if newest_first else SourceTakeaway.created_at.asc()
        )
        stmt = (
            select(SourceTakeaway)
            .where(
                SourceTakeaway.source_id == source_id,
                SourceTakeaway.user_id == user_id,
            )
            .order_by(order)
        )
        if limit is not None:
            stmt = stmt.limit(limit)
        result = await db.execute(stmt)
        return list(result.scalars().all())

    async def list_recent_with_source(
        self, db: AsyncSession, user_id: str, limit: int, offset: int
    ) -> list[tuple[SourceTakeaway, Source, str | None]]:
        """Recent takeaways across all sources, newest first. Each row carries the
        joined Source and a resolved image_url (podcast episode or video thumbnail)."""
        result = await db.execute(
            select(SourceTakeaway, Source, PodcastEpisode.image_url, Video.thumbnail_url)
            .join(Source, Source.id == SourceTakeaway.source_id)
            .outerjoin(PodcastEpisode, PodcastEpisode.id == Source.episode_id)
            .outerjoin(Video, Video.id == Source.video_id)
            .where(SourceTakeaway.user_id == user_id)
            .order_by(SourceTakeaway.updated_at.desc())
            .limit(limit)
            .offset(offset)
        )
        rows = result.all()
        return [(t, s, pe_img or v_thumb) for t, s, pe_img, v_thumb in rows]

    async def count_by_source(self, db: AsyncSession, source_id: int) -> int:
        result = await db.execute(
            select(func.count())
            .select_from(SourceTakeaway)
            .where(SourceTakeaway.source_id == source_id)
        )
        return int(result.scalar_one())

    async def add(self, db: AsyncSession, takeaway: SourceTakeaway) -> SourceTakeaway:
        db.add(takeaway)
        await db.flush()
        return takeaway

    async def delete(self, db: AsyncSession, takeaway_id: int, user_id: str) -> bool:
        existing = await self.get(db, takeaway_id, user_id)
        if existing is None:
            return False
        # Join rows in source_takeaway_citations and source_takeaway_captures are
        # removed automatically via ON DELETE CASCADE on takeaway_id (schema.sql).
        await db.delete(existing)
        return True

    # --- Link tables ---

    async def list_citations(self, db: AsyncSession, takeaway_id: int) -> list[Citation]:
        result = await db.execute(
            select(Citation)
            .join(
                SourceTakeawayCitation,
                SourceTakeawayCitation.citation_id == Citation.id,
            )
            .where(SourceTakeawayCitation.takeaway_id == takeaway_id)
            .order_by(SourceTakeawayCitation.created_at.asc())
        )
        return list(result.scalars().all())

    async def list_captures(self, db: AsyncSession, takeaway_id: int) -> list[Capture]:
        result = await db.execute(
            select(Capture)
            .join(
                SourceTakeawayCapture,
                SourceTakeawayCapture.capture_id == Capture.id,
            )
            .where(
                SourceTakeawayCapture.takeaway_id == takeaway_id,
                Capture.deleted_at.is_(None),
            )
            .order_by(SourceTakeawayCapture.created_at.asc())
        )
        return list(result.scalars().all())

    async def list_citation_ids(self, db: AsyncSession, takeaway_id: int) -> set[int]:
        result = await db.execute(
            select(SourceTakeawayCitation.citation_id).where(
                SourceTakeawayCitation.takeaway_id == takeaway_id
            )
        )
        return {int(row) for row in result.scalars().all()}

    async def list_capture_ids(self, db: AsyncSession, takeaway_id: int) -> set[int]:
        result = await db.execute(
            select(SourceTakeawayCapture.capture_id).where(
                SourceTakeawayCapture.takeaway_id == takeaway_id
            )
        )
        return {int(row) for row in result.scalars().all()}

    async def add_citation(
        self, db: AsyncSession, takeaway_id: int, citation_id: int, now: datetime
    ) -> None:
        db.add(
            SourceTakeawayCitation(
                takeaway_id=takeaway_id,
                citation_id=citation_id,
                created_at=now,
            )
        )
        await db.flush()

    async def remove_citation(self, db: AsyncSession, takeaway_id: int, citation_id: int) -> None:
        await db.execute(
            delete(SourceTakeawayCitation).where(
                SourceTakeawayCitation.takeaway_id == takeaway_id,
                SourceTakeawayCitation.citation_id == citation_id,
            )
        )

    async def add_capture(
        self, db: AsyncSession, takeaway_id: int, capture_id: int, now: datetime
    ) -> None:
        db.add(
            SourceTakeawayCapture(
                takeaway_id=takeaway_id,
                capture_id=capture_id,
                created_at=now,
            )
        )
        await db.flush()

    async def remove_capture(self, db: AsyncSession, takeaway_id: int, capture_id: int) -> None:
        await db.execute(
            delete(SourceTakeawayCapture).where(
                SourceTakeawayCapture.takeaway_id == takeaway_id,
                SourceTakeawayCapture.capture_id == capture_id,
            )
        )
