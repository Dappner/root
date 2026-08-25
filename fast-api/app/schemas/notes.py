from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

from app.core.datetime_utils import UTCDatetime

NoteKind = Literal["note", "insight"]


class CreateNoteRequest(BaseModel):
    title: str = ""
    kind: NoteKind = "note"
    source_id: int | None = None
    body: dict[str, Any] = Field(...)
    citation_ids: list[int] = Field(default_factory=list)


class UpdateNoteRequest(BaseModel):
    title: str = ""
    kind: NoteKind | None = None
    source_id: int | None = None
    body: dict[str, Any] = Field(...)
    citation_ids: list[int] = Field(default_factory=list)


class CreateNoteForSourceRequest(BaseModel):
    title: str = ""
    kind: NoteKind = "note"
    body: dict[str, Any] = Field(...)
    citation_ids: list[int] = Field(default_factory=list)


class NoteDTO(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: str
    source_id: int | None = None
    title: str
    kind: str
    body: dict[str, Any]
    citation_ids: list[int] = Field(default_factory=list)
    created_at: UTCDatetime
    updated_at: UTCDatetime


class NoteListDTO(BaseModel):
    """List shape — drops `body`, ships a truncated `plain_text` as `preview`."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: str
    source_id: int | None = None
    title: str
    kind: str
    preview: str
    created_at: UTCDatetime
    updated_at: UTCDatetime
