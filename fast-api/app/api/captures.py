"""Captures API.

Soft delete: DELETE marks `deleted_at = NOW()`. All reads filter
`deleted_at IS NULL`, so client-visible behavior is unchanged.

PUT preserves `section_id` — the update request has no section_id field, so
the value already on the row stays put. Section moves happen via the
sections/assign endpoint.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import BackgroundTasks, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user_id
from app.core.database import get_db
from app.core.exceptions import ValidationError
from app.core.routing import APIRouter
from app.deps import capture_service, citation_embedding_service
from app.schemas.captures import (
    CaptureDTO,
    CreateCaptureResponse,
    StructuredCreateCaptureRequest,
    UpdateCaptureRequest,
)
from app.schemas.problem import Problem
from app.services.capture_service import CaptureService
from app.services.citation_embedding_service import CitationEmbeddingService

router = APIRouter(tags=["captures"])


@router.post(
    "/captures",
    response_model=CreateCaptureResponse,
    response_model_exclude_none=True,
    status_code=status.HTTP_201_CREATED,
    operation_id="CreateCapture",
    summary="Create capture",
    description="Create a new capture with pre-defined metadata (source, section, citation link)",
    responses={
        400: {"model": Problem, "description": "Bad Request"},
        401: {"model": Problem, "description": "Unauthorized"},
        500: {"model": Problem, "description": "Internal Server Error"},
    },
)
async def create_capture(
    req: StructuredCreateCaptureRequest,
    background_tasks: BackgroundTasks,
    user_id: Annotated[str, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db, scope="function")],
    service: Annotated[CaptureService, Depends(capture_service)],
    embedding: Annotated[CitationEmbeddingService, Depends(citation_embedding_service)],
) -> CreateCaptureResponse:
    # Captures attached to a citation derive their location from the citation,
    # so section_id is incompatible with citation_id.
    if req.citation_id is not None and req.section_id is not None:
        raise ValidationError("section_id cannot be provided when citation_id is set")

    capture, source_started = await service.create(
        db=db,
        user_id=user_id,
        text=req.text,
        citation_id=req.citation_id,
        source_id=req.source_id,
        section_id=req.section_id,
        summary=req.summary,
    )
    background_tasks.add_task(embedding.generate_capture, capture.id, user_id)
    return CreateCaptureResponse(
        capture=CaptureDTO.model_validate(capture),
        source_started=source_started or None,
    )


@router.put(
    "/captures/{id}",
    response_model=CaptureDTO,
    response_model_exclude_none=True,
    operation_id="UpdateCapture",
    summary="Update capture",
    description="Update an existing capture",
    responses={
        400: {"model": Problem, "description": "Bad Request"},
        404: {"model": Problem, "description": "Not Found"},
    },
)
async def update_capture(
    id: int,
    req: UpdateCaptureRequest,
    background_tasks: BackgroundTasks,
    user_id: Annotated[str, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db, scope="function")],
    service: Annotated[CaptureService, Depends(capture_service)],
    embedding: Annotated[CitationEmbeddingService, Depends(citation_embedding_service)],
) -> CaptureDTO:
    capture = await service.update(
        db=db,
        user_id=user_id,
        capture_id=id,
        text=req.text,
        citation_id=req.citation_id,
        source_id=req.source_id,
        summary=req.summary,
    )
    background_tasks.add_task(embedding.generate_capture, capture.id, user_id)
    return CaptureDTO.model_validate(capture)


@router.delete(
    "/captures/{id}",
    status_code=status.HTTP_204_NO_CONTENT,
    operation_id="DeleteCapture",
    summary="Delete capture",
    description="Delete a capture by ID",
    responses={
        404: {"model": Problem, "description": "Not Found"},
    },
)
async def delete_capture(
    id: int,
    user_id: Annotated[str, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
    service: Annotated[CaptureService, Depends(capture_service)],
) -> None:
    await service.delete(db=db, user_id=user_id, capture_id=id)


@router.get(
    "/sources/{source_id}/captures",
    response_model=list[CaptureDTO],
    response_model_exclude_none=True,
    operation_id="ListCapturesBySource",
    summary="List captures for a source",
    description="Get all captures linked to a specific source",
    responses={
        401: {"model": Problem, "description": "Unauthorized"},
        404: {"model": Problem, "description": "Not Found"},
    },
)
async def list_captures_by_source(
    source_id: int,
    user_id: Annotated[str, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
    service: Annotated[CaptureService, Depends(capture_service)],
) -> list[CaptureDTO]:
    captures = await service.list_for_source(db=db, user_id=user_id, source_id=source_id)
    return [CaptureDTO.model_validate(c) for c in captures]
