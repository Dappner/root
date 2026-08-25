from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field

from app.core.datetime_utils import UTCDatetime


class CreateTagRequest(BaseModel):
    slug: str = Field(..., min_length=1, max_length=64)
    label: str = Field(..., min_length=1, max_length=128)
    color: str | None = Field(default=None, max_length=16)


class UpdateTagRequest(BaseModel):
    label: str = Field(..., min_length=1, max_length=128)
    color: str | None = Field(default=None, max_length=16)


class TagDTO(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: str
    slug: str
    label: str
    color: str | None = None
    created_at: UTCDatetime
    updated_at: UTCDatetime
