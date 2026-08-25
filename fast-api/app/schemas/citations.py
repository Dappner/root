from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, Field, TypeAdapter, field_validator

from app.core.datetime_utils import UTCDatetime
from app.schemas.citation_location import CitationLocation

LOCATION_ADAPTER: TypeAdapter[CitationLocation] = TypeAdapter(CitationLocation)


def _coerce_location(value: Any) -> CitationLocation | None:
    """Validate a raw dict from the DB JSON column into the typed union.

    Old rows may have malformed location payloads; tolerate them by returning
    None rather than failing the response.
    """
    if value is None:
        return None
    try:
        return LOCATION_ADAPTER.validate_python(value)
    except Exception:
        return None


class CreateCaptureInput(BaseModel):
    text: str = Field(min_length=1)
    summary: str | None = None


class UpdateCaptureInput(BaseModel):
    id: int
    text: str = Field(min_length=1)
    summary: str | None = None


class CapturesDelta(BaseModel):
    """Mutation set for a citation's captures applied atomically alongside the
    citation update. Each list is independent: omit a list to do nothing for
    that operation."""

    create: list[CreateCaptureInput] = Field(default_factory=list)
    update: list[UpdateCaptureInput] = Field(default_factory=list)
    delete: list[int] = Field(default_factory=list)


class CreateCitationRequest(BaseModel):
    text: str = Field(min_length=1)
    info_type: str = "quote"
    source_id: int | None = None
    section_id: int | None = None
    summary: str | None = None
    context: str | None = None
    speaker: str | None = None
    # Discriminated union across the 5 location types; mode/type/payload
    # combinations are checked at parse time. Cross-field validation (does
    # this location type match the source type?) lives in
    # citation_location_validation.py.
    location: CitationLocation | None = None
    captures: list[CreateCaptureInput] = Field(default_factory=list)
    suggestion_id: int | None = None


class CaptureResponse(BaseModel):
    # Accept the DB column name `content` when validating from the ORM, but
    # serialize as `text` so the API uses one consistent name (`text`)
    # everywhere.
    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,
    )

    id: int
    user_id: str
    text: str = Field(validation_alias="content", serialization_alias="text")
    source_id: int | None = None
    citation_id: int | None = None
    suggestion_id: int | None = None
    created_at: UTCDatetime
    updated_at: UTCDatetime


class CitationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: str
    info_type: str
    text: str
    summary: str | None = None
    source_id: int | None = None
    section_id: int | None = None
    location: CitationLocation | None = None
    speaker: str | None = None
    context: str | None = None
    suggestion_id: int | None = None
    created_at: UTCDatetime
    updated_at: UTCDatetime
    # All non-deleted captures attached to this citation. Populated by the
    # service/route read paths; defaults to empty when not loaded.
    captures: list[CaptureResponse] = Field(default_factory=list)

    @field_validator("location", mode="before")
    @classmethod
    def _validate_location(cls, value: Any) -> CitationLocation | None:
        return _coerce_location(value)

    @classmethod
    def from_orm_with_captures(cls, citation: Any, captures: list[Any]) -> "CitationResponse":
        """Build a response from an ORM citation plus an explicitly-loaded list
        of (non-deleted) captures.

        The `captures` relationship is NOT read off the ORM object: under an
        async session an unloaded relationship would trigger a lazy-load error,
        and it would also leak soft-deleted captures. Callers must pass the
        captures they fetched via the repository. Citation columns are pulled
        explicitly (rather than via `model_validate`) so the relationship is
        never touched.
        """
        return cls(
            id=citation.id,
            user_id=citation.user_id,
            info_type=citation.info_type,
            text=citation.text,
            summary=citation.summary,
            source_id=citation.source_id,
            section_id=citation.section_id,
            location=citation.location,
            speaker=citation.speaker,
            context=citation.context,
            suggestion_id=citation.suggestion_id,
            created_at=citation.created_at,
            updated_at=citation.updated_at,
            captures=[CaptureResponse.model_validate(c) for c in captures],
        )


class CreateCitationResponse(BaseModel):
    citation: CitationResponse
    captures: list[CaptureResponse] = Field(default_factory=list)
    source_started: bool = False


class UpdateCitationRequest(BaseModel):
    """Patch payload. Omit a field to preserve it; pass `null` for nullable
    fields (summary, speaker, context, section_id) to clear them.
    """

    model_config = ConfigDict(extra="forbid")

    info_type: str | None = None
    text: str | None = Field(default=None, min_length=1)
    summary: str | None = None
    source_id: int | None = None
    section_id: int | None = None
    location: CitationLocation | None = None
    speaker: str | None = None
    context: str | None = None
    # Omit to leave captures untouched. When present, the create/update/delete
    # sets are applied in the same transaction as the citation fields.
    captures: CapturesDelta | None = None
