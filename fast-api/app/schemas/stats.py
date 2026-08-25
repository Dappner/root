from datetime import date

from pydantic import BaseModel


class StatsCounts(BaseModel):
    sources: int
    citations: int
    captures: int
    takeaways: int


class WeeklyTrend(BaseModel):
    week_start: date
    sources_count: int
    citations_count: int
    captures_count: int
    takeaways_count: int


class FocusArea(BaseModel):
    label: str
    slug: str
    count: int


class TakeawayOfDay(BaseModel):
    id: int
    title: str
    body: str
    source_id: int
    source_title: str | None = None


class UserStatsResponse(BaseModel):
    counts: StatsCounts
    month_delta: StatsCounts
    weekly_trends: list[WeeklyTrend]
    focus_areas: list[FocusArea]
    takeaway_of_the_day: TakeawayOfDay | None = None
