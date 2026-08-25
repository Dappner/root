from typing import Annotated

from fastapi import BackgroundTasks, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user_id
from app.core.database import get_db
from app.core.exceptions import NotFoundError
from app.core.routing import APIRouter
from app.deps import video_import_service, video_repository
from app.repositories.video_repository import VideoRepository
from app.schemas.pagination import make_pagination_meta
from app.schemas.sources import SourceDTO
from app.schemas.videos import (
    AddVideoToLibraryRequest,
    ChannelDTO,
    ImportVideoRequest,
    PaginatedChannelResponse,
    PaginatedVideoResponse,
    VideoDTO,
)
from app.services.video_import_service import VideoImportService
from app.services.video_transcript_generator import get_video_transcript_generator

router = APIRouter(
    prefix="/videos",
    tags=["videos"],
    dependencies=[Depends(get_current_user_id)],
)


@router.post(
    "/import",
    response_model=VideoDTO,
    operation_id="importVideo",
    summary="Import a YouTube video",
)
async def import_video(
    payload: ImportVideoRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    service: Annotated[VideoImportService, Depends(video_import_service)],
) -> VideoDTO:
    """Import a video by URL or bare ID. Fetches metadata and creates/returns
    the video entry."""
    return await service.import_youtube_video(db, payload.url)


@router.post(
    "/from-video",
    response_model=SourceDTO,
    operation_id="addVideoToLibrary",
    summary="Add a video to the library",
)
async def add_video_to_library(
    payload: AddVideoToLibraryRequest,
    background_tasks: BackgroundTasks,
    db: Annotated[AsyncSession, Depends(get_db)],
    user_id: Annotated[str, Depends(get_current_user_id)],
    service: Annotated[VideoImportService, Depends(video_import_service)],
) -> SourceDTO:
    """Create (or refresh) a `video` source in the user's library and kick off
    transcript generation (which chains sectioning + embedding) in the
    background so the source is ready to use without a manual step."""
    source, should_ingest = await service.add_to_library(db, user_id, payload.video_id)
    if should_ingest:
        # Idempotent: the pipeline short-circuits if the video is already
        # pending/transcribed/embedded. Commits + schedules the background task.
        await get_video_transcript_generator().generate_transcript(
            payload.video_id, db, background_tasks
        )
    return source


@router.get(
    "/channels",
    response_model=PaginatedChannelResponse,
    operation_id="ListChannels",
    summary="List all channels",
)
async def list_channels(
    db: Annotated[AsyncSession, Depends(get_db)],
    repo: Annotated[VideoRepository, Depends(video_repository)],
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> PaginatedChannelResponse:
    channels = await repo.list_channels(db, limit=limit, offset=offset)
    total = await repo.count_channels(db)
    return PaginatedChannelResponse(
        data=[ChannelDTO.model_validate(c) for c in channels],
        pagination=make_pagination_meta(total, limit, offset),
    )


@router.get(
    "/channels/{id}",
    response_model=ChannelDTO,
    operation_id="GetChannel",
    summary="Get channel details",
)
async def get_channel(
    id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    repo: Annotated[VideoRepository, Depends(video_repository)],
) -> ChannelDTO:
    channel = await repo.get_channel(db, channel_id=id)
    if channel is None:
        raise NotFoundError("channel", id)
    return ChannelDTO.model_validate(channel)


@router.get(
    "/channels/{id}/videos",
    response_model=PaginatedVideoResponse,
    operation_id="ListChannelVideos",
    summary="List channel videos",
)
async def list_channel_videos(
    id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    repo: Annotated[VideoRepository, Depends(video_repository)],
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> PaginatedVideoResponse:
    channel = await repo.get_channel(db, channel_id=id)
    if channel is None:
        raise NotFoundError("channel", id)
    videos = await repo.list_videos_by_channel(db, channel_id=id, limit=limit, offset=offset)
    total = await repo.count_videos_by_channel(db, channel_id=id)
    return PaginatedVideoResponse(
        data=[VideoDTO.model_validate(v) for v in videos],
        pagination=make_pagination_meta(total, limit, offset),
    )


@router.get(
    "/{id}",
    response_model=VideoDTO,
    operation_id="GetVideo",
    summary="Get video details",
)
async def get_video(
    id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    repo: Annotated[VideoRepository, Depends(video_repository)],
) -> VideoDTO:
    video = await repo.get_video(db, video_id=id)
    if video is None:
        raise NotFoundError("video", id)
    return VideoDTO.model_validate(video)
