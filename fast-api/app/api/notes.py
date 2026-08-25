from __future__ import annotations

from typing import Annotated

from fastapi import Depends, Header, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user_id
from app.core.database import get_db
from app.core.routing import APIRouter
from app.deps import note_service
from app.repositories.note_repository import NoteListRow
from app.schemas.notes import (
    CreateNoteForSourceRequest,
    CreateNoteRequest,
    NoteDTO,
    NoteListDTO,
    UpdateNoteRequest,
)
from app.services.note_service import NoteService

router = APIRouter(tags=["notes"])


def _to_list_dto(row: NoteListRow) -> NoteListDTO:
    return NoteListDTO(
        id=row.id,
        user_id=row.user_id,
        source_id=row.source_id,
        title=row.title,
        kind=row.kind,
        preview=row.preview or "",
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


def _to_dto(note, citation_ids: list[int]) -> NoteDTO:  # type: ignore[no-untyped-def]
    return NoteDTO(
        id=note.id,
        user_id=note.user_id,
        source_id=note.source_id,
        title=note.title,
        kind=note.kind,
        body=note.body or {},
        citation_ids=citation_ids,
        created_at=note.created_at,
        updated_at=note.updated_at,
    )


@router.get("/notes", response_model=list[NoteListDTO], operation_id="ListNotes")
async def list_notes(
    user_id: Annotated[str, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
    service: Annotated[NoteService, Depends(note_service)],
) -> list[NoteListDTO]:
    notes = await service.list_for_user(db=db, user_id=user_id)
    return [_to_list_dto(n) for n in notes]


@router.post(
    "/notes",
    response_model=NoteDTO,
    status_code=status.HTTP_201_CREATED,
    operation_id="CreateNote",
)
async def create_note(
    req: CreateNoteRequest,
    user_id: Annotated[str, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
    service: Annotated[NoteService, Depends(note_service)],
) -> NoteDTO:
    note, citation_ids = await service.create(
        db=db,
        user_id=user_id,
        title=req.title,
        kind=req.kind,
        source_id=req.source_id,
        body=req.body,
        citation_ids=req.citation_ids,
    )
    return _to_dto(note, citation_ids)


@router.get("/notes/{note_id}", response_model=NoteDTO, operation_id="GetNote")
async def get_note(
    note_id: int,
    user_id: Annotated[str, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
    service: Annotated[NoteService, Depends(note_service)],
) -> NoteDTO:
    note, citation_ids = await service.get(db=db, user_id=user_id, note_id=note_id)
    return _to_dto(note, citation_ids)


@router.put("/notes/{note_id}", response_model=NoteDTO, operation_id="UpdateNote")
async def update_note(
    note_id: int,
    req: UpdateNoteRequest,
    user_id: Annotated[str, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
    service: Annotated[NoteService, Depends(note_service)],
    x_expected_updated_at: Annotated[str | None, Header(alias="X-Expected-Updated-At")] = None,
) -> NoteDTO:
    note, citation_ids = await service.update(
        db=db,
        user_id=user_id,
        note_id=note_id,
        title=req.title,
        kind=req.kind,
        source_id=req.source_id,
        body=req.body,
        citation_ids=req.citation_ids,
        expected_updated_at=x_expected_updated_at,
    )
    return _to_dto(note, citation_ids)


@router.delete(
    "/notes/{note_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    operation_id="DeleteNote",
)
async def delete_note(
    note_id: int,
    user_id: Annotated[str, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
    service: Annotated[NoteService, Depends(note_service)],
) -> None:
    await service.delete(db=db, user_id=user_id, note_id=note_id)


@router.get(
    "/sources/{source_id}/notes",
    response_model=list[NoteListDTO],
    operation_id="ListNotesBySource",
)
async def list_notes_by_source(
    source_id: int,
    user_id: Annotated[str, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
    service: Annotated[NoteService, Depends(note_service)],
) -> list[NoteListDTO]:
    notes = await service.list_for_source(db=db, user_id=user_id, source_id=source_id)
    return [_to_list_dto(n) for n in notes]


@router.post(
    "/sources/{source_id}/notes",
    response_model=NoteDTO,
    status_code=status.HTTP_201_CREATED,
    operation_id="CreateNoteForSource",
)
async def create_note_for_source(
    source_id: int,
    req: CreateNoteForSourceRequest,
    user_id: Annotated[str, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
    service: Annotated[NoteService, Depends(note_service)],
) -> NoteDTO:
    note, citation_ids = await service.create(
        db=db,
        user_id=user_id,
        title=req.title,
        kind=req.kind,
        source_id=source_id,
        body=req.body,
        citation_ids=req.citation_ids,
    )
    return _to_dto(note, citation_ids)
