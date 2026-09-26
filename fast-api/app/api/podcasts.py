from typing import Annotated

from fastapi import BackgroundTasks, Depends, Query, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user_id
from app.core.database import get_db
from app.core.exceptions import NotFoundError
from app.core.routing import APIRouter
from app.deps import (
    podcast_library_service,
    podcast_repository,
    podcast_sync_service,
)
from app.repositories.podcast_repository import PodcastRepository
from app.schemas.pagination import make_pagination_meta
from app.schemas.podcasts import (
    AddToLibraryRequest,
    PaginatedEpisodeResponse,
    PaginatedShowResponse,
    PodcastEpisodeDTO,
    PodcastImportRequest,
    ShowDTO,
    SourceDTO,
)
from app.services.podcast_library_service import PodcastLibraryService
from app.services.podcast_sync_service import PodcastSyncService

router = APIRouter(
    prefix="/podcasts",
    tags=["podcasts"],
    dependencies=[Depends(get_current_user_id)],
)


class SyncShowAccepted(BaseModel):
    accepted: bool = True


@router.post(
    "/import",
    response_model=ShowDTO,
    operation_id="importApplePodcast",
    summary="Resolve an Apple Podcasts URL and import the show + episodes",
)
async def import_apple_podcast(
    request: PodcastImportRequest,
    _user_id: Annotated[str, Depends(get_current_user_id)],
    sync_service: Annotated[PodcastSyncService, Depends(podcast_sync_service)],
) -> ShowDTO:
    show = await sync_service.import_apple(apple_url=request.apple_url)
    return ShowDTO.model_validate(show)


@router.post(
    "/from-episode",
    response_model=SourceDTO,
    operation_id="addPodcastEpisodeToLibrary",
)
async def add_podcast_episode_to_library(
    request: AddToLibraryRequest,
    background_tasks: BackgroundTasks,
    user_id: Annotated[str, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db, scope="function")],
    library_service: Annotated[PodcastLibraryService, Depends(podcast_library_service)],
) -> SourceDTO:
    return await library_service.add_to_library(
        user_id=user_id,
        episode_id=request.episode_id,
        db=db,
        background_tasks=background_tasks,
    )


@router.get(
    "",
    response_model=PaginatedShowResponse,
    operation_id="listPodcastShows",
    summary="List all syndicated shows",
)
async def list_podcast_shows(
    db: Annotated[AsyncSession, Depends(get_db)],
    repo: Annotated[PodcastRepository, Depends(podcast_repository)],
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> PaginatedShowResponse:
    shows = await repo.list_shows(db, limit=limit, offset=offset)
    total = await repo.count_shows(db)
    return PaginatedShowResponse(
        data=[ShowDTO.model_validate(s) for s in shows],
        pagination=make_pagination_meta(total, limit, offset),
    )


@router.get(
    "/{id}",
    response_model=ShowDTO,
    operation_id="getPodcastShow",
    summary="Get show details",
)
async def get_podcast_show(
    id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    repo: Annotated[PodcastRepository, Depends(podcast_repository)],
) -> ShowDTO:
    show = await repo.get_show_by_slug(db, slug=id)
    if show is None:
        raise NotFoundError("show", id)
    return ShowDTO.model_validate(show)


@router.get(
    "/{id}/episodes",
    response_model=PaginatedEpisodeResponse,
    operation_id="listPodcastEpisodes",
    summary="List show episodes",
)
async def list_podcast_episodes(
    id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    repo: Annotated[PodcastRepository, Depends(podcast_repository)],
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> PaginatedEpisodeResponse:
    show = await repo.get_show_by_slug(db, slug=id)
    if show is None:
        raise NotFoundError("show", id)
    episodes = await repo.list_episodes_by_show(db, show_id=show.id, limit=limit, offset=offset)
    total = await repo.count_episodes_by_show(db, show_id=show.id)
    return PaginatedEpisodeResponse(
        data=[PodcastEpisodeDTO.model_validate(e) for e in episodes],
        pagination=make_pagination_meta(total, limit, offset),
    )


@router.post(
    "/{id}/sync",
    response_model=SyncShowAccepted,
    operation_id="syncPodcastShow",
    summary="Trigger a refresh of a show's RSS feed",
    status_code=status.HTTP_202_ACCEPTED,
)
async def sync_podcast_show(
    id: str,
    background_tasks: BackgroundTasks,
    db: Annotated[AsyncSession, Depends(get_db, scope="function")],
    repo: Annotated[PodcastRepository, Depends(podcast_repository)],
    sync_service: Annotated[PodcastSyncService, Depends(podcast_sync_service)],
) -> SyncShowAccepted:
    show = await repo.get_show_by_slug(db, slug=id)
    if show is None:
        raise NotFoundError("show", id)
    background_tasks.add_task(
        sync_service.sync_show,
        rss_feed_url=show.rss_feed_url,
        slug=show.slug,
    )
    return SyncShowAccepted()
