from __future__ import annotations

from typing import Annotated

from fastapi import BackgroundTasks, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user_id
from app.core.database import get_db
from app.core.routing import APIRouter
from app.deps import takeaway_embedding_service, takeaway_service
from app.schemas.takeaways import (
    CreateTakeawayRequest,
    ParallelTakeaway,
    TakeawayResponse,
    TakeawayWithLinksResponse,
    UpdateTakeawayRequest,
)
from app.services import takeaway_parallels_service as parallels_module
from app.services.source_takeaway_service import SourceTakeawayService
from app.services.takeaway_embedding_service import TakeawayEmbeddingService
from app.services.takeaway_parallels_service import (
    TakeawayParallelsService,
    takeaway_parallels_service,
)

router = APIRouter(tags=["takeaways"])


@router.get(
    "/sources/{source_id}/takeaways",
    response_model=list[TakeawayWithLinksResponse],
)
async def list_takeaways(
    source_id: int,
    user_id: Annotated[str, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
    service: Annotated[SourceTakeawayService, Depends(takeaway_service)],
) -> list[TakeawayWithLinksResponse]:
    return await service.list_by_source_response(db, source_id, user_id)


@router.post(
    "/sources/{source_id}/takeaways",
    response_model=TakeawayWithLinksResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_takeaway(
    source_id: int,
    req: CreateTakeawayRequest,
    background_tasks: BackgroundTasks,
    user_id: Annotated[str, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
    service: Annotated[SourceTakeawayService, Depends(takeaway_service)],
    embedding: Annotated[TakeawayEmbeddingService, Depends(takeaway_embedding_service)],
) -> TakeawayWithLinksResponse:
    response, takeaway_id = await service.create_response(
        db,
        source_id=source_id,
        user_id=user_id,
        title=req.title,
        body_json=req.body_json,
        citation_ids=req.citation_ids,
        capture_ids=req.capture_ids,
    )
    background_tasks.add_task(embedding.generate, takeaway_id, user_id)
    return response


@router.get(
    "/sources/{source_id}/takeaways/{takeaway_id}",
    response_model=TakeawayWithLinksResponse,
)
async def get_takeaway(
    source_id: int,
    takeaway_id: int,
    user_id: Annotated[str, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
    service: Annotated[SourceTakeawayService, Depends(takeaway_service)],
) -> TakeawayWithLinksResponse:
    return await service.get_response(db, takeaway_id, user_id, source_id=source_id)


@router.put(
    "/sources/{source_id}/takeaways/{takeaway_id}",
    response_model=TakeawayWithLinksResponse,
)
async def update_takeaway(
    source_id: int,
    takeaway_id: int,
    req: UpdateTakeawayRequest,
    background_tasks: BackgroundTasks,
    user_id: Annotated[str, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
    service: Annotated[SourceTakeawayService, Depends(takeaway_service)],
    embedding: Annotated[TakeawayEmbeddingService, Depends(takeaway_embedding_service)],
) -> TakeawayWithLinksResponse:
    response, takeaway_id = await service.update_response(
        db,
        takeaway_id=takeaway_id,
        user_id=user_id,
        title=req.title,
        body_json=req.body_json,
        citation_ids=req.citation_ids,  # None preserves existing
        capture_ids=req.capture_ids,  # None preserves existing
        source_id=source_id,
    )
    # ON CONFLICT DO UPDATE means stale embeddings get overwritten — no pre-delete needed.
    background_tasks.add_task(embedding.generate, takeaway_id, user_id)
    return response


@router.delete(
    "/sources/{source_id}/takeaways/{takeaway_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_takeaway(
    source_id: int,
    takeaway_id: int,
    user_id: Annotated[str, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
    service: Annotated[SourceTakeawayService, Depends(takeaway_service)],
) -> None:
    await service.delete(db, takeaway_id, user_id, source_id=source_id)


@router.get(
    "/takeaways/recent",
    response_model=list[TakeawayResponse],
)
async def list_recent_takeaways(
    user_id: Annotated[str, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
    service: Annotated[SourceTakeawayService, Depends(takeaway_service)],
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> list[TakeawayResponse]:
    """Recent takeaways across all sources for the current user, newest first.
    Slim shape (no citations/captures) for list views like the library tab."""
    return await service.list_recent_response(db, user_id, limit, offset)


@router.get(
    "/takeaways/{takeaway_id}/parallels",
    response_model=list[ParallelTakeaway],
)
async def get_takeaway_parallels(
    takeaway_id: int,
    user_id: Annotated[str, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
    service: Annotated[TakeawayParallelsService, Depends(takeaway_parallels_service)],
    limit: int = Query(default=parallels_module.DEFAULT_LIMIT, ge=1, le=10),
) -> list[ParallelTakeaway]:
    """Cross-source nearest-neighbor takeaways."""
    return await service.get_parallels(
        db,
        user_id=user_id,
        takeaway_id=takeaway_id,
        limit=limit,
    )
