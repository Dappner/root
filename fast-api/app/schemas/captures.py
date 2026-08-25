"""Captures API schemas."""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field

from app.core.datetime_utils import UTCDatetime


class CaptureDTO(BaseModel):
    """A capture row.

    Null fields are omitted from responses by the project APIRouter default.
    """

    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,
    )

    id: int
    user_id: str
    text: str = Field(validation_alias="content", serialization_alias="text")
    created_at: UTCDatetime
    updated_at: UTCDatetime
    citation_id: int | None = None
    source_id: int | None = None
    section_id: int | None = None
    summary: str | None = None
    suggestion_id: int | None = None


class StructuredCreateCaptureRequest(BaseModel):
    """Create-capture request body.

    `text` is required and must not be empty. Cross-field rule: `citation_id`
    and `section_id` cannot both be set; the handler raises 400 with
    `detail: "section_id cannot be provided when citation_id is set"`.
    """

    text: str = Field(min_length=1)
    citation_id: int | None = None
    source_id: int | None = None
    section_id: int | None = None
    summary: str | None = None


class UpdateCaptureRequest(BaseModel):
    """Update-capture request body. No `section_id` field — assignment to a
    section uses the sections/assign endpoint instead."""

    text: str = Field(min_length=1)
    citation_id: int | None = None
    source_id: int | None = None
    summary: str | None = None


class CreateCaptureResponse(BaseModel):
    """Wraps the created capture with the optional lifecycle-transition flag.

    `source_started` is true only when the create triggered a source
    todo→in_progress transition; otherwise omitted from the response by the
    project APIRouter default.
    """

    capture: CaptureDTO | None = None
    source_started: bool | None = None
