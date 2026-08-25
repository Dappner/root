import hashlib
from datetime import UTC, datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories.stats_repository import StatsRepository
from app.schemas.stats import (
    FocusArea,
    StatsCounts,
    TakeawayOfDay,
    UserStatsResponse,
    WeeklyTrend,
)

_repo = StatsRepository()


class StatsService:
    async def get_for_user(
        self,
        db: AsyncSession,
        user_id: str,
        weeks_back: int = 12,
    ) -> UserStatsResponse:
        # A single AsyncSession can only run one statement at a time, so these
        # are sequential. They are all cheap indexed lookups; parallelism would
        # require multiple sessions/connections and isn't worth it here.
        counts_row = await _repo.counts(db, user_id)
        trend_rows = await _repo.weekly_trends(db, user_id, weeks_back=weeks_back)
        focus_rows = await _repo.focus_areas(db, user_id, limit=4)
        takeaway = await self._takeaway_of_the_day(db, user_id)

        counts = StatsCounts(
            sources=counts_row["sources"],
            citations=counts_row["citations"],
            captures=counts_row["captures"],
            takeaways=counts_row["takeaways"],
        )
        month_delta = StatsCounts(
            sources=counts_row["sources_30d"],
            citations=counts_row["citations_30d"],
            captures=counts_row["captures_30d"],
            takeaways=counts_row["takeaways_30d"],
        )
        weekly_trends = [
            WeeklyTrend(
                week_start=row["week_start"],
                sources_count=row["sources_count"],
                citations_count=row["citations_count"],
                captures_count=row["captures_count"],
                takeaways_count=row["takeaways_count"],
            )
            for row in trend_rows
        ]
        focus_areas = [
            FocusArea(label=row["label"], slug=row["slug"], count=row["count"])
            for row in focus_rows
        ]

        return UserStatsResponse(
            counts=counts,
            month_delta=month_delta,
            weekly_trends=weekly_trends,
            focus_areas=focus_areas,
            takeaway_of_the_day=takeaway,
        )

    async def _takeaway_of_the_day(self, db: AsyncSession, user_id: str) -> TakeawayOfDay | None:
        ids = await _repo.takeaway_pool_ids(db, user_id)
        if not ids:
            return None
        today_utc = datetime.now(UTC).date().isoformat()
        seed = f"{user_id}:{today_utc}".encode()
        idx = int(hashlib.sha256(seed).hexdigest(), 16) % len(ids)
        row = await _repo.takeaway_by_id(db, user_id, ids[idx])
        if row is None:
            return None
        return TakeawayOfDay(
            id=row["id"],
            title=row["title"],
            body=row["body"],
            source_id=row["source_id"],
            source_title=row["source_title"],
        )
