"""Global citation/capture → section backfill (one-shot migration path).

Used only by the deprecated `/transcript/sections/backfill-citations` admin
endpoint. The migration has converged in prod; keeping this around so the
admin button still works for stragglers but no new callers should land here.

The per-source equivalent in `TranscriptSectioningService` does this work in
Python rather than SQL because the SQL form has hit a Postgres planner crash
(`rt_fetch used out-of-bounds`) on some plan shapes. The global path here
hasn't tripped that crash so far — likely shape-dependent on individual
source data. If it ever does, the right fix is to drive this path through the
same per-source Python loop the sectioning service uses.
"""

from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

# AV citations (podcast / video sources) are slotted into the section whose
# range_start..range_end contains the citation's start timestamp. Pulls
# tStartSec from either the canonical av_v1 location or the legacy
# transcript_v1 location, whichever is present.
_BACKFILL_AV_CITATION_SECTIONS_SQL = text("""
UPDATE citations c
SET section_id = matched.new_section_id,
    updated_at = NOW()
FROM (
    SELECT
        cit.id AS citation_id,
        (
            SELECT ss.id
            FROM source_sections ss
            WHERE ss.source_id = cit.source_id
              AND ss.range_start IS NOT NULL
              AND ss.range_end IS NOT NULL
              AND COALESCE(
                    (cit.location->'av'->>'tStartSec')::float,
                    (cit.location->'transcript'->>'tStartSec')::float
                  ) >= ss.range_start
              AND COALESCE(
                    (cit.location->'av'->>'tStartSec')::float,
                    (cit.location->'transcript'->>'tStartSec')::float
                  ) < ss.range_end
            LIMIT 1
        ) AS new_section_id
    FROM citations cit
    JOIN sources src ON src.id = cit.source_id
    WHERE cit.source_id IS NOT NULL
      AND src.type IN ('podcast', 'video')
) AS matched
WHERE c.id = matched.citation_id
  AND matched.new_section_id IS NOT NULL
  AND c.section_id IS DISTINCT FROM matched.new_section_id
""")

# Book citations are slotted by page number. A section without an explicit
# upper bound (range_end IS NULL) is treated as open-ended for ordering, so
# the LIMIT 1 picks the tightest enclosing section.
_BACKFILL_BOOK_CITATION_SECTIONS_SQL = text("""
UPDATE citations c
SET section_id = matched.new_section_id,
    updated_at = NOW()
FROM (
    SELECT
        cit.id AS citation_id,
        (
            SELECT ss.id
            FROM source_sections ss
            WHERE ss.source_id = cit.source_id
              AND (ss.range_start IS NOT NULL OR ss.range_end IS NOT NULL)
              AND (ss.range_start IS NULL OR book_loc.page_start >= ss.range_start)
              AND (ss.range_end IS NULL OR book_loc.page_start <= ss.range_end)
            ORDER BY
              ss.range_start DESC NULLS LAST,
              ss.range_end ASC NULLS LAST,
              ss.order_index ASC,
              ss.id ASC
            LIMIT 1
        ) AS new_section_id
    FROM citations cit
    JOIN sources src ON src.id = cit.source_id
    CROSS JOIN LATERAL (
        SELECT CASE
            WHEN (cit.location->'book'->>'pageStart') ~ '^[0-9]+$'
            THEN (cit.location->'book'->>'pageStart')::int
            ELSE NULL
        END AS page_start
    ) AS book_loc
    WHERE cit.source_id IS NOT NULL
      AND src.type = 'book'
      AND book_loc.page_start IS NOT NULL
) AS matched
WHERE c.id = matched.citation_id
  AND matched.new_section_id IS NOT NULL
  AND c.section_id IS DISTINCT FROM matched.new_section_id
""")

# Captures inherit the section of the citation they're linked to.
_BACKFILL_LINKED_CAPTURE_SECTIONS_SQL = text("""
UPDATE captures cap
SET section_id = c.section_id,
    updated_at = NOW()
FROM citations c
WHERE cap.citation_id = c.id
  AND c.section_id IS NOT NULL
  AND cap.section_id IS DISTINCT FROM c.section_id
""")

# An AV capture with no citation can't be slotted into a section by content
# (no timestamp to match against), so any leftover section_id on those rows
# is stale — clear it.
_CLEAR_UNLINKED_AV_CAPTURE_SECTIONS_SQL = text("""
UPDATE captures cap
SET section_id = NULL,
    updated_at = NOW()
FROM sources src
WHERE cap.source_id = src.id
  AND src.type IN ('podcast', 'video')
  AND cap.citation_id IS NULL
  AND cap.section_id IS NOT NULL
""")


@dataclass(frozen=True)
class BackfillResult:
    citations_changed: int
    captures_changed: int


class TranscriptBackfillRepository:
    async def backfill_citation_sections(self, db: AsyncSession) -> BackfillResult:
        """Run the 4-statement global backfill. Caller owns the transaction
        (the existing endpoint commits after this returns)."""
        av = await db.execute(_BACKFILL_AV_CITATION_SECTIONS_SQL)
        book = await db.execute(_BACKFILL_BOOK_CITATION_SECTIONS_SQL)
        linked_cap = await db.execute(_BACKFILL_LINKED_CAPTURE_SECTIONS_SQL)
        unlinked_av = await db.execute(_CLEAR_UNLINKED_AV_CAPTURE_SECTIONS_SQL)

        citations = (getattr(av, "rowcount", 0) or 0) + (getattr(book, "rowcount", 0) or 0)
        captures = (getattr(linked_cap, "rowcount", 0) or 0) + (
            getattr(unlinked_av, "rowcount", 0) or 0
        )
        return BackfillResult(citations_changed=citations, captures_changed=captures)
