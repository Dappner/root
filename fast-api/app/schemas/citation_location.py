"""Pydantic models for the citation `location` discriminated union.

Five location types, two modes; the mode/type combination is constrained at
parse time by `model_validator`. Cross-field rules that depend on the
*source* (e.g. PDF page count, source-type ↔ location-type compatibility)
live in `app/services/citation_location_validation.py` since they require a
DB read.
"""

from __future__ import annotations

from typing import Annotated, Literal, Union

from pydantic import BaseModel, ConfigDict, Field, model_validator

# ── Payloads ──────────────────────────────────────────────────────────────────


class BookLocationPayload(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    page_start: int = Field(alias="pageStart", ge=1)
    page_end: int | None = Field(default=None, alias="pageEnd", ge=1)

    @model_validator(mode="after")
    def _end_after_start(self) -> "BookLocationPayload":
        if self.page_end is not None and self.page_end < self.page_start:
            raise ValueError("pageEnd must be >= pageStart")
        return self


class AvLocationPayload(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    t_start_sec: float = Field(alias="tStartSec", ge=0)
    t_end_sec: float | None = Field(default=None, alias="tEndSec", ge=0)

    @model_validator(mode="after")
    def _end_after_start(self) -> "AvLocationPayload":
        if self.t_end_sec is not None and self.t_end_sec < self.t_start_sec:
            raise ValueError("tEndSec must be >= tStartSec")
        return self


class OtherLocationPayload(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    fallback_label: str = Field(alias="fallbackLabel", min_length=1)


class TranscriptLocationPayload(BaseModel):
    """Multi-anchor transcript metadata. tStartSec/tEndSec remain the source of
    truth for playback UI; the utterance indices anchor the highlight in case
    the transcript is re-sectioned.
    """

    model_config = ConfigDict(populate_by_name=True)

    utterance_start_idx: int = Field(alias="utteranceStartIdx", ge=0)
    utterance_end_idx: int = Field(alias="utteranceEndIdx", ge=0)
    char_offset_start: int | None = Field(default=None, alias="charOffsetStart", ge=0)
    char_offset_end: int | None = Field(default=None, alias="charOffsetEnd", ge=0)
    t_start_sec: float = Field(alias="tStartSec", ge=0)
    t_end_sec: float | None = Field(default=None, alias="tEndSec", ge=0)

    @model_validator(mode="after")
    def _ranges_ordered(self) -> "TranscriptLocationPayload":
        if self.utterance_end_idx < self.utterance_start_idx:
            raise ValueError("utteranceEndIdx must be >= utteranceStartIdx")
        if self.t_end_sec is not None and self.t_end_sec < self.t_start_sec:
            raise ValueError("tEndSec must be >= tStartSec")
        return self


class PdfRect(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    x1: float
    y1: float
    x2: float
    y2: float
    width: float = Field(gt=0)
    height: float = Field(gt=0)
    page_number: int = Field(alias="pageNumber", ge=1)

    @model_validator(mode="after")
    def _bounds_ordered(self) -> "PdfRect":
        if self.x2 <= self.x1 or self.y2 <= self.y1:
            raise ValueError("rect must have valid x/y bounds")
        return self


class PdfPosition(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    bounding_rect: PdfRect = Field(alias="boundingRect")
    rects: list[PdfRect] = Field(min_length=1)
    page_number: int = Field(alias="pageNumber", ge=1)


class PdfLocationPayload(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    position: PdfPosition


# ── Locations (mode + type + payload triples) ─────────────────────────────────
#
# Two-level discriminator: first on `type`, then mode is constrained per type.
# Manual mode covers book/av/other; derived mode covers transcript/pdf.


class BookLocation(BaseModel):
    mode: Literal["manual"]
    type: Literal["book_v1"]
    book: BookLocationPayload


class AvLocation(BaseModel):
    mode: Literal["manual"]
    type: Literal["av_v1"]
    av: AvLocationPayload


class OtherLocation(BaseModel):
    mode: Literal["manual"]
    type: Literal["other_v1"]
    other: OtherLocationPayload


class TranscriptLocation(BaseModel):
    mode: Literal["derived"]
    type: Literal["transcript_v1"]
    transcript: TranscriptLocationPayload


class PdfLocation(BaseModel):
    mode: Literal["derived"]
    type: Literal["pdf_v1"]
    pdf: PdfLocationPayload


CitationLocation = Annotated[
    Union[BookLocation, AvLocation, OtherLocation, TranscriptLocation, PdfLocation],
    Field(discriminator="type"),
]
