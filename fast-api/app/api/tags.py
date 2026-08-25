from __future__ import annotations

from typing import Annotated

from fastapi import Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user_id
from app.core.database import get_db
from app.core.routing import APIRouter
from app.deps import tag_service
from app.schemas.tags import CreateTagRequest, TagDTO, UpdateTagRequest
from app.services.tag_service import TagService

router = APIRouter(tags=["tags"])


@router.get("/tags", response_model=list[TagDTO], operation_id="ListTags")
async def list_tags(
    user_id: Annotated[str, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
    service: Annotated[TagService, Depends(tag_service)],
) -> list[TagDTO]:
    tags = await service.list_for_user(db=db, user_id=user_id)
    return [TagDTO.model_validate(t) for t in tags]


@router.post(
    "/tags",
    response_model=TagDTO,
    status_code=status.HTTP_201_CREATED,
    operation_id="CreateTag",
)
async def create_tag(
    req: CreateTagRequest,
    user_id: Annotated[str, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
    service: Annotated[TagService, Depends(tag_service)],
) -> TagDTO:
    tag = await service.create(
        db=db, user_id=user_id, slug=req.slug, label=req.label, color=req.color
    )
    return TagDTO.model_validate(tag)


@router.get("/tags/{tag_id}", response_model=TagDTO, operation_id="GetTag")
async def get_tag(
    tag_id: int,
    user_id: Annotated[str, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
    service: Annotated[TagService, Depends(tag_service)],
) -> TagDTO:
    tag = await service.get(db=db, user_id=user_id, tag_id=tag_id)
    return TagDTO.model_validate(tag)


@router.put("/tags/{tag_id}", response_model=TagDTO, operation_id="UpdateTag")
async def update_tag(
    tag_id: int,
    req: UpdateTagRequest,
    user_id: Annotated[str, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
    service: Annotated[TagService, Depends(tag_service)],
) -> TagDTO:
    tag = await service.update(
        db=db, user_id=user_id, tag_id=tag_id, label=req.label, color=req.color
    )
    return TagDTO.model_validate(tag)


@router.delete(
    "/tags/{tag_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    operation_id="DeleteTag",
)
async def delete_tag(
    tag_id: int,
    user_id: Annotated[str, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
    service: Annotated[TagService, Depends(tag_service)],
) -> None:
    await service.delete(db=db, user_id=user_id, tag_id=tag_id)
