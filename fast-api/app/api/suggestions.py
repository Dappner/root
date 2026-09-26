from datetime import datetime
from typing import Annotated

from fastapi import (
    BackgroundTasks,
    Depends,
    File,
    Form,
    Query,
    UploadFile,
)
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user_id
from app.core.database import get_db
from app.core.routing import APIRouter
from app.deps import citation_embedding_service, suggestion_service
from app.schemas.suggestions import (
    ApproveSuggestionRequest,
    ApproveSuggestionResponse,
    RetrySuggestionRequest,
    SuggestionListResponse,
    SuggestionResponse,
    SuggestionStatus,
)
from app.services.citation_embedding_service import CitationEmbeddingService
from app.services.suggestion_service import SuggestionService

router = APIRouter(tags=["suggestions"])


@router.post("/suggestions/voice", response_model=SuggestionResponse)
async def create_voice_suggestion(
    background_tasks: BackgroundTasks,
    user_id: Annotated[str, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db, scope="function")],
    service: Annotated[SuggestionService, Depends(suggestion_service)],
    file: Annotated[UploadFile, File()],
    client_id: Annotated[str, Form()],
    source_id: Annotated[int, Form()],
    episode_id: Annotated[int | None, Form()] = None,
    playback_position_seconds: Annotated[float | None, Form()] = None,
    recorded_at: Annotated[datetime | None, Form()] = None,
) -> SuggestionResponse:
    suggestion = await service.create_voice_suggestion(
        db=db,
        user_id=user_id,
        file=file,
        client_id=client_id,
        source_id=source_id,
        episode_id=episode_id,
        playback_position_seconds=playback_position_seconds,
        recorded_at=recorded_at,
    )
    if suggestion.status in ("uploaded", "failed"):
        background_tasks.add_task(service.process_voice_suggestion, suggestion.id)
    return SuggestionResponse.model_validate(suggestion)


@router.get("/sources/{source_id}/suggestions", response_model=SuggestionListResponse)
async def list_source_suggestions(
    source_id: int,
    user_id: Annotated[str, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
    service: Annotated[SuggestionService, Depends(suggestion_service)],
) -> SuggestionListResponse:
    suggestions = await service.list_for_source(db=db, user_id=user_id, source_id=source_id)
    return SuggestionListResponse(
        suggestions=[SuggestionResponse.model_validate(s) for s in suggestions]
    )


@router.get("/suggestions", response_model=SuggestionListResponse)
async def list_suggestions(
    user_id: Annotated[str, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
    service: Annotated[SuggestionService, Depends(suggestion_service)],
    status: Annotated[str | None, Query()] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
) -> SuggestionListResponse:
    statuses: list[SuggestionStatus] | None = None
    if status is not None:
        statuses = [s.strip() for s in status.split(",")]  # type: ignore[misc]
    suggestions = await service.list_for_user(
        db=db,
        user_id=user_id,
        statuses=statuses,
        limit=limit,
    )
    return SuggestionListResponse(
        suggestions=[SuggestionResponse.model_validate(s) for s in suggestions]
    )


@router.get("/suggestions/{suggestion_id}", response_model=SuggestionResponse)
async def get_suggestion(
    suggestion_id: int,
    user_id: Annotated[str, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
    service: Annotated[SuggestionService, Depends(suggestion_service)],
) -> SuggestionResponse:
    suggestion = await service.get(db=db, user_id=user_id, suggestion_id=suggestion_id)
    return SuggestionResponse.model_validate(suggestion)


@router.post("/suggestions/{suggestion_id}/approve", response_model=ApproveSuggestionResponse)
async def approve_suggestion(
    suggestion_id: int,
    payload: ApproveSuggestionRequest,
    background_tasks: BackgroundTasks,
    user_id: Annotated[str, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db, scope="function")],
    service: Annotated[SuggestionService, Depends(suggestion_service)],
    embedding: Annotated[CitationEmbeddingService, Depends(citation_embedding_service)],
) -> ApproveSuggestionResponse:
    suggestion, citation_ids, capture_ids = await service.approve(
        db=db,
        user_id=user_id,
        suggestion_id=suggestion_id,
        payload_override=payload.payload,
    )
    for cid in citation_ids:
        background_tasks.add_task(embedding.generate_citation, cid, user_id)
    for cid in capture_ids:
        background_tasks.add_task(embedding.generate_capture, cid, user_id)
    return ApproveSuggestionResponse(
        suggestion=SuggestionResponse.model_validate(suggestion),
        citation_ids=citation_ids,
        capture_ids=capture_ids,
    )


@router.post("/suggestions/{suggestion_id}/retry", response_model=SuggestionResponse)
async def retry_suggestion(
    suggestion_id: int,
    background_tasks: BackgroundTasks,
    user_id: Annotated[str, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db, scope="function")],
    service: Annotated[SuggestionService, Depends(suggestion_service)],
    body: RetrySuggestionRequest | None = None,
) -> SuggestionResponse:
    suggestion = await service.retry(db=db, user_id=user_id, suggestion_id=suggestion_id)
    refinement = body.refinement if body else None
    background_tasks.add_task(service.process_voice_suggestion, suggestion_id, refinement)
    return SuggestionResponse.model_validate(suggestion)


@router.post("/suggestions/{suggestion_id}/dismiss", response_model=SuggestionResponse)
async def dismiss_suggestion(
    suggestion_id: int,
    user_id: Annotated[str, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
    service: Annotated[SuggestionService, Depends(suggestion_service)],
) -> SuggestionResponse:
    suggestion = await service.dismiss(db=db, user_id=user_id, suggestion_id=suggestion_id)
    return SuggestionResponse.model_validate(suggestion)
