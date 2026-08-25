"""Collections API."""

from __future__ import annotations

from typing import Annotated

from fastapi import Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user_id
from app.core.database import get_db
from app.core.routing import APIRouter
from app.deps import collection_service
from app.schemas.collections import (
    CollectionDTO,
    CollectionSourceIDsDTO,
    CollectionSourceRequest,
    CreateCollectionRequest,
    UpdateCollectionRequest,
)
from app.schemas.problem import Problem
from app.services.collection_service import CollectionService

router = APIRouter(tags=["collections"])


def _to_dto(row: tuple) -> CollectionDTO:
    collection, source_count = row
    return CollectionDTO.model_validate(
        {
            "id": collection.id,
            "name": collection.name,
            "description": collection.description,
            "source_count": source_count,
            "created_at": collection.created_at,
            "updated_at": collection.updated_at,
        }
    )


@router.post(
    "/collections",
    response_model=CollectionDTO,
    response_model_exclude_none=True,
    status_code=status.HTTP_201_CREATED,
    operation_id="CreateCollection",
    summary="Create a new collection",
    description="Create a new collection for grouping sources",
    responses={
        400: {"model": Problem, "description": "Bad Request"},
        401: {"model": Problem, "description": "Unauthorized"},
        500: {"model": Problem, "description": "Internal Server Error"},
    },
)
async def create_collection(
    req: CreateCollectionRequest,
    user_id: Annotated[str, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
    service: Annotated[CollectionService, Depends(collection_service)],
) -> CollectionDTO:
    row = await service.create(db=db, user_id=user_id, name=req.name, description=req.description)
    return _to_dto(row)


@router.get(
    "/collections",
    response_model=list[CollectionDTO],
    response_model_exclude_none=True,
    operation_id="ListCollections",
    summary="List collections",
    description="List all collections for the authenticated user",
    responses={
        401: {"model": Problem, "description": "Unauthorized"},
        500: {"model": Problem, "description": "Internal Server Error"},
    },
)
async def list_collections(
    user_id: Annotated[str, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
    service: Annotated[CollectionService, Depends(collection_service)],
) -> list[CollectionDTO]:
    rows = await service.list_for_user(db=db, user_id=user_id)
    return [_to_dto(row) for row in rows]


@router.get(
    "/collections/{id}",
    response_model=CollectionDTO,
    response_model_exclude_none=True,
    operation_id="GetCollection",
    summary="Get a collection",
    description="Get a collection by ID",
    responses={
        401: {"model": Problem, "description": "Unauthorized"},
        404: {"model": Problem, "description": "Not Found"},
        500: {"model": Problem, "description": "Internal Server Error"},
    },
)
async def get_collection(
    id: int,
    user_id: Annotated[str, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
    service: Annotated[CollectionService, Depends(collection_service)],
) -> CollectionDTO:
    row = await service.get(db=db, user_id=user_id, collection_id=id)
    return _to_dto(row)


@router.put(
    "/collections/{id}",
    response_model=CollectionDTO,
    response_model_exclude_none=True,
    operation_id="UpdateCollection",
    summary="Update a collection",
    description="Update an existing collection's name and description",
    responses={
        400: {"model": Problem, "description": "Bad Request"},
        401: {"model": Problem, "description": "Unauthorized"},
        404: {"model": Problem, "description": "Not Found"},
        500: {"model": Problem, "description": "Internal Server Error"},
    },
)
async def update_collection(
    id: int,
    req: UpdateCollectionRequest,
    user_id: Annotated[str, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
    service: Annotated[CollectionService, Depends(collection_service)],
) -> CollectionDTO:
    row = await service.update(
        db=db,
        user_id=user_id,
        collection_id=id,
        name=req.name,
        description=req.description,
    )
    return _to_dto(row)


@router.delete(
    "/collections/{id}",
    status_code=status.HTTP_204_NO_CONTENT,
    operation_id="DeleteCollection",
    summary="Delete a collection",
    description="Delete a collection by ID (sources are not deleted)",
    responses={
        401: {"model": Problem, "description": "Unauthorized"},
        404: {"model": Problem, "description": "Not Found"},
        500: {"model": Problem, "description": "Internal Server Error"},
    },
)
async def delete_collection(
    id: int,
    user_id: Annotated[str, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
    service: Annotated[CollectionService, Depends(collection_service)],
) -> None:
    await service.delete(db=db, user_id=user_id, collection_id=id)


@router.get(
    "/collections/{id}/sources",
    response_model=CollectionSourceIDsDTO,
    operation_id="ListCollectionSources",
    summary="List source IDs in a collection",
    description="Returns the IDs of all sources in the collection",
    responses={
        401: {"model": Problem, "description": "Unauthorized"},
        404: {"model": Problem, "description": "Not Found"},
        500: {"model": Problem, "description": "Internal Server Error"},
    },
)
async def list_collection_sources(
    id: int,
    user_id: Annotated[str, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
    service: Annotated[CollectionService, Depends(collection_service)],
) -> CollectionSourceIDsDTO:
    source_ids = await service.list_source_ids(db=db, user_id=user_id, collection_id=id)
    return CollectionSourceIDsDTO(source_ids=source_ids)


@router.post(
    "/collections/{id}/sources",
    status_code=status.HTTP_204_NO_CONTENT,
    operation_id="AddSourceToCollection",
    summary="Add a source to a collection",
    description="Add a source to an existing collection",
    responses={
        400: {"model": Problem, "description": "Bad Request"},
        401: {"model": Problem, "description": "Unauthorized"},
        404: {"model": Problem, "description": "Not Found"},
        500: {"model": Problem, "description": "Internal Server Error"},
    },
)
async def add_source_to_collection(
    id: int,
    req: CollectionSourceRequest,
    user_id: Annotated[str, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
    service: Annotated[CollectionService, Depends(collection_service)],
) -> None:
    await service.add_source(db=db, user_id=user_id, collection_id=id, source_id=req.source_id)


@router.delete(
    "/collections/{id}/sources/{source_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    operation_id="RemoveSourceFromCollection",
    summary="Remove a source from a collection",
    description="Remove a source from an existing collection",
    responses={
        401: {"model": Problem, "description": "Unauthorized"},
        404: {"model": Problem, "description": "Not Found"},
        500: {"model": Problem, "description": "Internal Server Error"},
    },
)
async def remove_source_from_collection(
    id: int,
    source_id: int,
    user_id: Annotated[str, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
    service: Annotated[CollectionService, Depends(collection_service)],
) -> None:
    await service.remove_source(db=db, user_id=user_id, collection_id=id, source_id=source_id)
