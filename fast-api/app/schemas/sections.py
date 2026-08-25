from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.core.datetime_utils import UTCDatetime


class CreateSourceSectionRequest(BaseModel):
    """Create a section under a source.

    `title` is required (trimmed non-empty enforced server-side). `subtitle`
    and `summary` are optional free text; ranges are optional non-negative
    offsets with `range_end >= range_start` when both are present.
    """

    title: str = Field(min_length=1)
    subtitle: str | None = Field(default=None, max_length=255)
    summary: str | None = Field(default=None, max_length=1024)
    range_start: int | None = Field(default=None, ge=0)
    range_end: int | None = Field(default=None, ge=0)

    @model_validator(mode="after")
    def _check_range(self) -> "CreateSourceSectionRequest":
        if self.range_start is not None and self.range_end is not None:
            if self.range_end < self.range_start:
                raise ValueError("range_end cannot be before range_start")
        return self


class UpdateSourceSectionRequest(BaseModel):
    """PATCH a section. Omitted fields are preserved; an empty string clears an
    optional text field (subtitle/summary).

    `title` is required on the wire (PATCH still re-sends the title).
    """

    title: str = Field(min_length=1)
    subtitle: str | None = Field(default=None, max_length=255)
    summary: str | None = Field(default=None, max_length=1024)
    range_start: int | None = Field(default=None, ge=0)
    range_end: int | None = Field(default=None, ge=0)


class ReorderSourceSectionsRequest(BaseModel):
    """Ordered list of section IDs. Each ID must belong to the source; partial
    sets are allowed (only the listed sections are renumbered)."""

    section_ids: list[int] = Field(min_length=1)


class MoveHighlightToSectionRequest(BaseModel):
    """Request to move a citation or capture to a section.

    `section_id` may be null to unset (move back to the source's unsectioned
    bucket).
    """

    highlight_id: int = Field(gt=0)
    highlight_type: Literal["citation", "capture"]
    section_id: int | None = None


class SourceSectionResponse(BaseModel):
    """Section row returned from the list endpoint, including the
    `generated_by` discriminator."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    source_id: int
    title: str
    subtitle: str | None = None
    order_index: int
    range_start: int | None = None
    range_end: int | None = None
    summary: str | None = None
    generated_by: Literal["user", "auto"]
    created_at: UTCDatetime
    updated_at: UTCDatetime
