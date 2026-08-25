"""Videos & channels API schemas."""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict

from app.core.datetime_utils import UTCDatetime
from app.schemas.pagination import PaginationMeta


class ChannelDTO(BaseModel):
    """Video channel (YouTube, Vimeo, etc.). `metadata` (jsonb) intentionally
    not exposed yet — add a typed sub-model when there are real fields."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    platform: str
    platform_id: str
    name: str
    description: str | None = None
    thumbnail_url: str | None = None
    subscriber_count: int | None = None
    video_count: int | None = None
    custom_url: str | None = None
    created_at: UTCDatetime
    updated_at: UTCDatetime


class VideoDTO(BaseModel):
    """Video from a platform (YouTube, Vimeo, etc.). `metadata` (jsonb)
    intentionally not exposed yet."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    channel_id: int | None = None
    platform: str
    platform_id: str
    title: str
    description: str | None = None
    thumbnail_url: str | None = None
    duration: int | None = None
    view_count: int | None = None
    embed_url: str | None = None
    transcript_status: str
    transcript_error: str | None = None
    transcript_source: str | None = None
    published_at: UTCDatetime | None = None
    created_at: UTCDatetime
    updated_at: UTCDatetime


class ImportVideoRequest(BaseModel):
    """Import a video by URL or bare ID ({"url": ...})."""

    url: str


class AddVideoToLibraryRequest(BaseModel):
    """Add an imported video to the user's library ({"video_id": ...})."""

    video_id: int


class PaginatedChannelResponse(BaseModel):
    data: list[ChannelDTO]
    pagination: PaginationMeta


class PaginatedVideoResponse(BaseModel):
    data: list[VideoDTO]
    pagination: PaginationMeta
