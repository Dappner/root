from typing import Literal

from pydantic import BaseModel, Field

from app.core.datetime_utils import UTCDatetime
from app.schemas.podcasts import SourceDTO
from app.schemas.takeaways import TakeawayResponse

HomeActivityType = Literal["citation", "capture", "takeaway", "note"]


class HomeNoteDTO(BaseModel):
    id: int
    title: str
    kind: str
    updated_at: UTCDatetime
    preview: str = ""
    word_count: int = 0
    citation_count: int = 0


class HomePrimaryItem(BaseModel):
    kind: Literal["source", "note"]
    activity_type: HomeActivityType
    last_activity_at: UTCDatetime
    source: SourceDTO | None = None
    section_id: int | None = None
    section_title: str | None = None
    note: HomeNoteDTO | None = None


class HomeRecentSource(BaseModel):
    source: SourceDTO
    activity_type: HomeActivityType
    last_activity_at: UTCDatetime


class HomeRecentHighlight(BaseModel):
    kind: Literal["citation", "capture"]
    id: int
    source_id: int | None = None
    source_title: str | None = None
    source_type: str | None = None
    section_id: int | None = None
    section_title: str | None = None
    text: str
    summary: str | None = None
    info_type: str | None = None
    created_at: UTCDatetime
    updated_at: UTCDatetime


class HomePickupNote(BaseModel):
    id: int
    title: str
    kind: str
    preview: str = ""
    word_count: int = 0
    updated_at: UTCDatetime


class HomeRecentlyCaptured(BaseModel):
    source: SourceDTO
    captured_at: UTCDatetime


class HomeResponse(BaseModel):
    primary: HomePrimaryItem | None = None
    recent_sources: list[HomeRecentSource] = Field(default_factory=list)
    recent_highlights: list[HomeRecentHighlight] = Field(default_factory=list)
    recent_takeaways: list[TakeawayResponse] = Field(default_factory=list)
    pickup_notes: list[HomePickupNote] = Field(default_factory=list)
    recently_captured: list[HomeRecentlyCaptured] = Field(default_factory=list)
