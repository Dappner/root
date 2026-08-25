from collections.abc import Sequence

from sqlalchemy import text
from sqlalchemy.engine import RowMapping
from sqlalchemy.ext.asyncio import AsyncSession

_COUNTS_SQL = text("""
    WITH cutoff AS (SELECT now() - interval '30 days' AS d)
    SELECT
        (SELECT count(*) FROM sources
            WHERE user_id = :user_id) AS sources,
        (SELECT count(*) FROM citations
            WHERE user_id = :user_id) AS citations,
        (SELECT count(*) FROM captures
            WHERE user_id = :user_id AND deleted_at IS NULL) AS captures,
        (SELECT count(*) FROM source_takeaways
            WHERE user_id = :user_id) AS takeaways,
        (SELECT count(*) FROM sources
            WHERE user_id = :user_id
              AND created_at >= (SELECT d FROM cutoff)) AS sources_30d,
        (SELECT count(*) FROM citations
            WHERE user_id = :user_id
              AND created_at >= (SELECT d FROM cutoff)) AS citations_30d,
        (SELECT count(*) FROM captures
            WHERE user_id = :user_id AND deleted_at IS NULL
              AND created_at >= (SELECT d FROM cutoff)) AS captures_30d,
        (SELECT count(*) FROM source_takeaways
            WHERE user_id = :user_id
              AND created_at >= (SELECT d FROM cutoff)) AS takeaways_30d
""")


_WEEKLY_TRENDS_SQL = text("""
    WITH weeks AS (
        SELECT generate_series(
            date_trunc('week', now()) - make_interval(weeks => :weeks_back),
            date_trunc('week', now()),
            interval '1 week'
        )::date AS week_start
    )
    SELECT
        w.week_start,
        (SELECT count(*) FROM sources s
            WHERE s.user_id = :user_id
              AND s.created_at >= w.week_start
              AND s.created_at < w.week_start + interval '1 week') AS sources_count,
        (SELECT count(*) FROM citations c
            WHERE c.user_id = :user_id
              AND c.created_at >= w.week_start
              AND c.created_at < w.week_start + interval '1 week') AS citations_count,
        (SELECT count(*) FROM captures cp
            WHERE cp.user_id = :user_id
              AND cp.deleted_at IS NULL
              AND cp.created_at >= w.week_start
              AND cp.created_at < w.week_start + interval '1 week') AS captures_count,
        (SELECT count(*) FROM source_takeaways t
            WHERE t.user_id = :user_id
              AND t.created_at >= w.week_start
              AND t.created_at < w.week_start + interval '1 week') AS takeaways_count
    FROM weeks w
    ORDER BY w.week_start
""")


_FOCUS_AREAS_SQL = text("""
    SELECT t.label, t.slug, count(DISTINCT st.source_id)::int AS count
    FROM tags t
    JOIN source_tags st ON st.tag_id = t.id
    WHERE t.user_id = :user_id
    GROUP BY t.id, t.label, t.slug
    ORDER BY count DESC, t.label
    LIMIT :limit
""")


_TAKEAWAY_POOL_SQL = text("""
    SELECT id
    FROM source_takeaways
    WHERE user_id = :user_id
      AND length(body) >= 50
    ORDER BY id
""")


_TAKEAWAY_BY_ID_SQL = text("""
    SELECT
        t.id,
        t.title,
        t.body,
        t.source_id,
        s.title AS source_title
    FROM source_takeaways t
    JOIN sources s ON s.id = t.source_id
    WHERE t.id = :id AND t.user_id = :user_id
""")


class StatsRepository:
    async def counts(self, db: AsyncSession, user_id: str) -> RowMapping:
        result = await db.execute(_COUNTS_SQL, {"user_id": user_id})
        row = result.mappings().one()
        return row

    async def weekly_trends(
        self, db: AsyncSession, user_id: str, weeks_back: int = 12
    ) -> Sequence[RowMapping]:
        result = await db.execute(
            _WEEKLY_TRENDS_SQL,
            {"user_id": user_id, "weeks_back": weeks_back},
        )
        return result.mappings().all()

    async def focus_areas(
        self, db: AsyncSession, user_id: str, limit: int = 4
    ) -> Sequence[RowMapping]:
        result = await db.execute(
            _FOCUS_AREAS_SQL,
            {"user_id": user_id, "limit": limit},
        )
        return result.mappings().all()

    async def takeaway_pool_ids(self, db: AsyncSession, user_id: str) -> list[int]:
        result = await db.execute(_TAKEAWAY_POOL_SQL, {"user_id": user_id})
        return [row["id"] for row in result.mappings().all()]

    async def takeaway_by_id(
        self, db: AsyncSession, user_id: str, takeaway_id: int
    ) -> RowMapping | None:
        result = await db.execute(
            _TAKEAWAY_BY_ID_SQL,
            {"id": takeaway_id, "user_id": user_id},
        )
        return result.mappings().first()
