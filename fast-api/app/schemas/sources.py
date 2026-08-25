from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.core.datetime_utils import UTCDatetime
from app.schemas.source_metadata import SourceMetadata, parse_source_metadata

SourceStatus = Literal["todo", "in_progress", "reflecting", "done"]


class SourceDTO(BaseModel):
    """Canonical source payload returned by the CRUD + RAG endpoints.

    Re-exported from `app.schemas.podcasts` for compatibility. `metadata` is the
    typed `SourceMetadata` discriminated union; `coerce_metadata` parses the raw
    jsonb blob against the authoritative `type` before validation.
    """

    id: int
    title: str
    type: str
    status: SourceStatus
    metadata: SourceMetadata | None = None
    summary_short: str | None = None
    summary_long: str | None = None
    tag_ids: list[int] = Field(default_factory=list)
    collection_ids: list[int] = Field(default_factory=list)
    capture_count: int | None = None
    citation_count: int | None = None
    takeaway_count: int | None = None
    published_at: UTCDatetime | None = None
    last_active_at: UTCDatetime | None = None
    started_at: UTCDatetime | None = None
    reflecting_at: UTCDatetime | None = None
    completed_at: UTCDatetime | None = None
    episode_id: int | None = None
    video_id: int | None = None
    duration: int | None = None
    episode: str | None = None
    image_url: str | None = None
    media_url: str | None = None
    source_url: str | None = None
    label: str | None = None
    author: str | None = None
    created_at: UTCDatetime
    updated_at: UTCDatetime

    @model_validator(mode="before")
    @classmethod
    def coerce_metadata(cls, data: object) -> object:
        if not isinstance(data, dict):
            return data
        raw = data.get("metadata")
        if isinstance(raw, dict):
            source_type = data.get("type")
            if isinstance(source_type, str):
                data = dict(data)
                data["metadata"] = parse_source_metadata(raw, source_type)
        return data


class CreateSourceRequest(BaseModel):
    """Create a new source. Title is trimmed and validated server-side (empty
    after trim is rejected); status defaults to `todo`."""

    title: str = Field(default="", max_length=500)
    type: str = Field(min_length=1, max_length=50)
    status: SourceStatus | None = None
    label: str | None = Field(default=None, max_length=100)
    author: str | None = Field(default=None, max_length=255)
    published_at: UTCDatetime | None = None
    metadata: dict | None = None


class UpdateSourceRequest(BaseModel):
    """PUT-merge update. Omitted (None) fields are left untouched.

    `tag_ids` is tri-state: None leaves tags untouched, [] clears all tags, and
    a populated list replaces them.
    """

    title: str | None = Field(default=None, max_length=500)
    type: str | None = Field(default=None, max_length=50)
    status: SourceStatus | None = None
    label: str | None = Field(default=None, max_length=100)
    author: str | None = Field(default=None, max_length=255)
    published_at: UTCDatetime | None = None
    metadata: dict | None = None
    tag_ids: list[int] | None = None


class EnrichSourceRequest(BaseModel):
    """A URL to fetch lightweight metadata for (oEmbed / OpenGraph)."""

    url: str = Field(min_length=1)


class EnrichSourceResponse(BaseModel):
    """Enriched metadata extracted from a URL. All fields optional — providers
    rarely populate every field."""

    title: str | None = None
    site_name: str | None = None
    author_name: str | None = None
    description: str | None = None


class SourceCounts(BaseModel):
    """Type-based source counts surfaced in the list response metadata."""

    all: int
    book: int
    article: int
    video: int
    podcast: int
    pdf: int


class SourcesMetadata(BaseModel):
    counts: SourceCounts


class SourcesListResponse(BaseModel):
    """List of sources plus type-count metadata (shape consumed by the library
    page's filter chips)."""

    sources: list[SourceDTO]
    metadata: SourcesMetadata


class TransitionSourceStatusRequest(BaseModel):
    """Target lifecycle status for a source transition."""

    status: SourceStatus


class PdfUploadResponse(BaseModel):
    """Returned after a successful PDF upload."""

    size_bytes: int


class PdfUrlResponse(BaseModel):
    """A URL to fetch a source's stored PDF. `expires_in` is set only for
    presigned URLs (seconds until expiry)."""

    url: str
    expires_in: int | None = None


class UpdateSourceSummariesRequest(BaseModel):
    """Update a source's long summary. `summary_long` is written verbatim,
    so passing null clears it."""

    summary_long: str | None = None


class SourceSummariesResponse(BaseModel):
    """Summary fields returned after an update. Scoped to what clients read
    back; full source payloads come from the source CRUD endpoints."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    summary_long: str | None = None
    updated_at: UTCDatetime


class SourceStatusResponse(BaseModel):
    """Lifecycle fields returned after a status transition.

    Scoped to the fields a client needs to reconcile its cache; full source
    payloads come from the source CRUD endpoints.
    """

    model_config = ConfigDict(from_attributes=True)

    id: int
    status: SourceStatus
    started_at: UTCDatetime | None = None
    reflecting_at: UTCDatetime | None = None
    completed_at: UTCDatetime | None = None
    last_active_at: UTCDatetime | None = None
    updated_at: UTCDatetime
