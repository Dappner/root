"""Source-section data access.

Owns mutations to `source_sections`. Read-side queries that join sections
into broader views live with their owning repository (search, source detail,
etc.); this repo is only for write paths that have nowhere else natural
to live.
"""

from __future__ import annotations

from sqlalchemy import delete, insert, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.database import Source, SourceSection

# After auto-sectioning lands a new batch, every section for the source needs
# a fresh order_index so user and auto rows interleave by start time. Done in
# one statement so we don't fetch all rows just to renumber them.
_RESTAMP_ORDER_INDEX_SQL = text("""
    UPDATE source_sections AS ss
    SET order_index = sub.new_idx,
        updated_at = NOW()
    FROM (
        SELECT id,
               ROW_NUMBER() OVER (
                   ORDER BY range_start NULLS LAST, created_at, id
               ) - 1 AS new_idx
        FROM source_sections
        WHERE source_id = :source_id
    ) AS sub
    WHERE ss.id = sub.id
    """)

# order_index is COALESCE(MAX(order_index)+1, 0) per source, so user-created
# sections append to the end.
_CREATE_SQL = text("""
    WITH next_order AS (
        SELECT COALESCE(MAX(order_index) + 1, 0) AS order_index
        FROM source_sections
        WHERE source_id = :source_id
    )
    INSERT INTO source_sections (
        source_id, title, subtitle, order_index, range_start, range_end,
        summary, summary_sha256, generated_by, created_at, updated_at
    )
    VALUES (
        :source_id, :title, :subtitle, (SELECT order_index FROM next_order),
        :range_start, :range_end, :summary, :summary_sha256, 'user',
        NOW(), NOW()
    )
    RETURNING id
    """)

# Unnest the ordered ids with ordinality and write each id's position. Scoped to
# the source, so ids that aren't members are silently skipped (membership is
# enforced in the service).
_REORDER_SQL = text("""
    UPDATE source_sections AS ss
    SET order_index = new_order.order_index,
        updated_at = NOW()
    FROM (
        SELECT id, (ord - 1) AS order_index
        FROM unnest(CAST(:section_ids AS int4[])) WITH ORDINALITY AS t(id, ord)
    ) AS new_order
    WHERE ss.id = new_order.id AND ss.source_id = :source_id
    """)


class SourceSectionRepository:
    async def get(self, db: AsyncSession, section_id: int) -> SourceSection | None:
        result = await db.execute(select(SourceSection).where(SourceSection.id == section_id))
        return result.scalar_one_or_none()

    async def get_for_user(
        self, db: AsyncSession, section_id: int, user_id: str
    ) -> SourceSection | None:
        """Load a section by id, scoped to its owning user via the source join."""
        result = await db.execute(
            select(SourceSection)
            .join(Source, Source.id == SourceSection.source_id)
            .where(SourceSection.id == section_id, Source.user_id == user_id)
        )
        return result.scalar_one_or_none()

    async def list_by_source(
        self, db: AsyncSession, source_id: int, limit: int | None = None
    ) -> list[SourceSection]:
        stmt = (
            select(SourceSection)
            .where(SourceSection.source_id == source_id)
            .order_by(SourceSection.order_index.asc())
        )
        if limit is not None:
            stmt = stmt.limit(limit)
        result = await db.execute(stmt)
        return list(result.scalars().all())

    async def list_by_source_for_user(
        self,
        db: AsyncSession,
        source_id: int,
        user_id: str,
        limit: int | None = None,
    ) -> list[SourceSection]:
        """Ordered sections for a source, scoped to the owning user."""
        stmt = (
            select(SourceSection)
            .join(Source, Source.id == SourceSection.source_id)
            .where(SourceSection.source_id == source_id, Source.user_id == user_id)
            .order_by(SourceSection.order_index.asc(), SourceSection.id.asc())
        )
        if limit is not None:
            stmt = stmt.limit(limit)
        result = await db.execute(stmt)
        return list(result.scalars().all())

    async def has_auto_sections(self, db: AsyncSession, source_id: int) -> bool:
        """True if the source has any auto-generated sections."""
        result = await db.execute(
            select(SourceSection.id)
            .where(
                SourceSection.source_id == source_id,
                SourceSection.generated_by == "auto",
            )
            .limit(1)
        )
        return result.scalar_one_or_none() is not None

    async def episode_has_auto_sections(self, db: AsyncSession, episode_id: int) -> bool:
        """True if any source linked to this episode has an auto-generated
        section. Used by episode-level section backfill to skip done episodes."""
        result = await db.execute(
            select(SourceSection.id)
            .join(Source, Source.id == SourceSection.source_id)
            .where(
                Source.episode_id == episode_id,
                SourceSection.generated_by == "auto",
            )
            .limit(1)
        )
        return result.scalar_one_or_none() is not None

    async def list_ranges_for_source(
        self, db: AsyncSession, source_id: int
    ) -> list[tuple[int, int, int]]:
        """`(id, range_start, range_end)` for sections of a source that carry a
        numeric range — used for in-memory timestamp matching during backfills."""
        result = await db.execute(
            select(SourceSection.id, SourceSection.range_start, SourceSection.range_end).where(
                SourceSection.source_id == source_id,
                SourceSection.range_start.is_not(None),
                SourceSection.range_end.is_not(None),
            )
        )
        return [(row[0], row[1], row[2]) for row in result.all()]

    async def find_section_id_by_timestamp(
        self, db: AsyncSession, source_id: int, t_start_sec: float
    ) -> int | None:
        """Id of the section whose `[range_start, range_end)` covers the given
        start timestamp, or None. Single-lookup variant of the range match."""
        result = await db.execute(
            select(SourceSection.id)
            .where(
                SourceSection.source_id == source_id,
                SourceSection.range_start.is_not(None),
                SourceSection.range_end.is_not(None),
                SourceSection.range_start <= t_start_sec,
                SourceSection.range_end > t_start_sec,
            )
            .limit(1)
        )
        return result.scalar_one_or_none()

    async def create(
        self,
        db: AsyncSession,
        *,
        source_id: int,
        title: str,
        subtitle: str | None,
        summary: str | None,
        summary_sha256: str | None,
        range_start: int | None,
        range_end: int | None,
    ) -> int:
        result = await db.execute(
            _CREATE_SQL,
            {
                "source_id": source_id,
                "title": title,
                "subtitle": subtitle,
                "summary": summary,
                "summary_sha256": summary_sha256,
                "range_start": range_start,
                "range_end": range_end,
            },
        )
        return int(result.scalar_one())

    async def update(
        self,
        db: AsyncSession,
        section: SourceSection,
        *,
        title: str,
        subtitle: str | None,
        summary: str | None,
        summary_sha256: str | None,
        range_start: int | None,
        range_end: int | None,
        updated_at: object,
    ) -> None:
        section.title = title
        section.subtitle = subtitle
        section.summary = summary
        section.summary_sha256 = summary_sha256
        section.range_start = range_start
        section.range_end = range_end
        section.updated_at = updated_at  # type: ignore[assignment]
        await db.flush()

    async def delete(self, db: AsyncSession, section_id: int, source_id: int) -> None:
        await db.execute(
            delete(SourceSection).where(
                SourceSection.id == section_id,
                SourceSection.source_id == source_id,
            )
        )

    async def reorder(self, db: AsyncSession, source_id: int, section_ids: list[int]) -> None:
        await db.execute(_REORDER_SQL, {"source_id": source_id, "section_ids": section_ids})

    async def replace_auto_sections(
        self,
        db: AsyncSession,
        *,
        source_id: int,
        sections: list[dict],
    ) -> None:
        """Drop the prior auto-generated sections for a source and write the
        new batch. User-authored sections (generated_by != 'auto') are
        preserved untouched. Caller owns the transaction.

        Each entry in `sections` must already carry the full row shape
        (`source_id`, `title`, `range_start`, `range_end`, `order_index`,
        `generated_by`) — this repo doesn't synthesize fields.
        """
        await db.execute(
            delete(SourceSection).where(
                SourceSection.source_id == source_id,
                SourceSection.generated_by == "auto",
            )
        )
        if sections:
            await db.execute(insert(SourceSection), sections)

    async def restamp_order_index(self, db: AsyncSession, source_id: int) -> None:
        """Re-number `order_index` across every section for the source by
        `(range_start NULLS LAST, created_at, id)` so user and auto sections
        interleave deterministically. Idempotent."""
        await db.execute(_RESTAMP_ORDER_INDEX_SQL, {"source_id": source_id})
