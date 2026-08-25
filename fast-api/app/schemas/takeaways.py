from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field

from app.core.datetime_utils import UTCDatetime
from app.schemas.citations import CaptureResponse, CitationResponse


class CreateTakeawayRequest(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    body_json: dict | None = None
    citation_ids: list[int] = Field(default_factory=list)
    capture_ids: list[int] = Field(default_factory=list)


class UpdateTakeawayRequest(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    body_json: dict | None = None
    # None = preserve existing links; an explicit list (even empty) replaces them.
    citation_ids: list[int] | None = None
    capture_ids: list[int] | None = None


class TakeawaySourceRef(BaseModel):
    """Slim source reference embedded on takeaway list/detail responses.

    Enough to render a takeaway row ("from <title>") without an N+1 source fetch.
    """

    id: int
    title: str
    type: str
    image_url: str | None = None


class TakeawayResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: str
    source: TakeawaySourceRef
    title: str
    body: str
    body_json: dict | None = None
    content_sha256: str | None = None
    created_at: UTCDatetime
    updated_at: UTCDatetime


class TakeawayWithLinksResponse(TakeawayResponse):
    citations: list[CitationResponse] = Field(default_factory=list)
    captures: list[CaptureResponse] = Field(default_factory=list)


class ParallelTakeaway(BaseModel):
    """A semantically-near takeaway from a different source — surfaces in the
    parallels panel to seed cross-source synthesis (the takeaway → note step
    on the synthesis ladder)."""

    takeaway_id: int
    source_id: int
    source_title: str
    source_type: str
    title: str
    snippet: str
    similarity: float
