"""Collections API schemas."""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field

from app.core.datetime_utils import UTCDatetime


class CreateCollectionRequest(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=1000)


class UpdateCollectionRequest(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=1000)


class CollectionDTO(BaseModel):
    """A collection row joined with its source_count.

    `description` is omitted from the response when null by the project
    APIRouter default. `source_count` is always present, even when zero.
    """

    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: str | None = None
    source_count: int = 0
    created_at: UTCDatetime
    updated_at: UTCDatetime


class CollectionSourceRequest(BaseModel):
    """Body for POST /collections/{id}/sources."""

    source_id: int = Field(gt=0)


class CollectionSourceIDsDTO(BaseModel):
    """Response for GET /collections/{id}/sources."""

    source_ids: list[int]
