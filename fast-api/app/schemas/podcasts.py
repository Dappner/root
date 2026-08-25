from pydantic import BaseModel, ConfigDict, Field

from app.core.datetime_utils import UTCDatetime
from app.schemas.pagination import PaginationMeta
from app.schemas.sources import SourceDTO  # re-export: canonical home is sources.py

__all__ = [
    "AddToLibraryRequest",
    "PaginatedEpisodeResponse",
    "PaginatedShowResponse",
    "PodcastEpisodeDTO",
    "PodcastImportRequest",
    "ShowDTO",
    "SourceDTO",
]


class AddToLibraryRequest(BaseModel):
    episode_id: int = Field(..., ge=1)


class PodcastImportRequest(BaseModel):
    apple_url: str = Field(..., min_length=1)


class ShowDTO(BaseModel):
    """Podcast show. `metadata` (jsonb) is intentionally not exposed yet —
    add a typed sub-model when there are real fields to surface."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    slug: str
    rss_feed_url: str
    title: str
    description: str | None = None
    image_url: str | None = None
    language: str | None = None
    explicit: bool | None = None
    author: str | None = None
    link: str | None = None
    last_synced_at: UTCDatetime | None = None
    categories: list[str] | None = None
    created_at: UTCDatetime
    updated_at: UTCDatetime


class PodcastEpisodeDTO(BaseModel):
    """Podcast episode. `metadata` (jsonb) intentionally not exposed yet."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    episode_guid: str
    title: str
    description: str | None = None
    season: int | None = None
    episode_number: int | None = None
    duration: int | None = None
    enclosure_url: str | None = None
    r2_audio_key: str | None = None
    transcript_status: str
    transcript_error: str | None = None
    transcript_source: str | None = None
    image_url: str | None = None
    published_at: UTCDatetime | None = None
    created_at: UTCDatetime
    updated_at: UTCDatetime


class PaginatedShowResponse(BaseModel):
    data: list[ShowDTO]
    pagination: PaginationMeta


class PaginatedEpisodeResponse(BaseModel):
    data: list[PodcastEpisodeDTO]
    pagination: PaginationMeta
