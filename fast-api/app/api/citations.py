from __future__ import annotations

from typing import Annotated

from fastapi import BackgroundTasks, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user_id
from app.core.database import get_db
from app.core.routing import APIRouter
from app.deps import citation_embedding_service, citation_service
from app.schemas.citations import (
    CaptureResponse,
    CitationResponse,
    CreateCitationRequest,
    CreateCitationResponse,
    UpdateCitationRequest,
)
from app.services.citation_embedding_service import CitationEmbeddingService
from app.services.citation_patch import update_kwargs_from_request
from app.services.citation_service import CitationService

router = APIRouter(tags=["citations"])


@router.post("/citations", response_model=CreateCitationResponse, status_code=201)
async def create_citation(
    req: CreateCitationRequest,
    background_tasks: BackgroundTasks,
    user_id: Annotated[str, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db, scope="function")],
    service: Annotated[CitationService, Depends(citation_service)],
    embedding: Annotated[CitationEmbeddingService, Depends(citation_embedding_service)],
) -> CreateCitationResponse:
    citation, captures, source_started = await service.create(db=db, user_id=user_id, req=req)
    background_tasks.add_task(embedding.generate_citation, citation.id, user_id)
    for capture in captures:
        background_tasks.add_task(embedding.generate_capture, capture.id, user_id)
    return CreateCitationResponse(
        citation=CitationResponse.from_orm_with_captures(citation, captures),
        captures=[CaptureResponse.model_validate(c) for c in captures],
        source_started=source_started,
    )


@router.patch("/citations/{citation_id}", response_model=CitationResponse)
async def update_citation(
    citation_id: int,
    req: UpdateCitationRequest,
    background_tasks: BackgroundTasks,
    user_id: Annotated[str, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db, scope="function")],
    service: Annotated[CitationService, Depends(citation_service)],
    embedding: Annotated[CitationEmbeddingService, Depends(citation_embedding_service)],
) -> CitationResponse:
    citation, doc_affecting = await service.update(
        db=db, user_id=user_id, citation_id=citation_id, **update_kwargs_from_request(req)
    )
    if doc_affecting:
        background_tasks.add_task(embedding.generate_citation, citation.id, user_id)
    if req.captures is not None:
        changed = await service.apply_captures_delta(
            db=db, user_id=user_id, citation=citation, delta=req.captures
        )
        for capture in changed:
            background_tasks.add_task(embedding.generate_capture, capture.id, user_id)
    return await service.to_response_with_captures(db=db, citation=citation)


@router.delete("/citations/{citation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_citation(
    citation_id: int,
    user_id: Annotated[str, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
    service: Annotated[CitationService, Depends(citation_service)],
) -> None:
    await service.delete(db=db, user_id=user_id, citation_id=citation_id)


@router.get("/citations/{citation_id}", response_model=CitationResponse)
async def get_citation(
    citation_id: int,
    user_id: Annotated[str, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
    service: Annotated[CitationService, Depends(citation_service)],
) -> CitationResponse:
    return await service.get(db=db, user_id=user_id, citation_id=citation_id)


@router.get("/citations", response_model=list[CitationResponse])
async def list_citations(
    user_id: Annotated[str, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
    service: Annotated[CitationService, Depends(citation_service)],
    unsorted: Annotated[bool, Query(description="Return citations with no source")] = False,
) -> list[CitationResponse]:
    return (
        await service.list_unsorted(db=db, user_id=user_id)
        if unsorted
        else await service.list_for_user(db=db, user_id=user_id)
    )


@router.get(
    "/sources/{source_id}/citations",
    response_model=list[CitationResponse],
    operation_id="ListCitationsBySource",
)
async def list_source_citations(
    source_id: int,
    user_id: Annotated[str, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
    service: Annotated[CitationService, Depends(citation_service)],
) -> list[CitationResponse]:
    return await service.list_for_source(db=db, user_id=user_id, source_id=source_id)
