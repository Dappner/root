from typing import Annotated

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user_id
from app.core.database import get_db
from app.core.routing import APIRouter
from app.deps import playback_service
from app.schemas.playback import PlaybackProgressRequest, PlaybackProgressResponse
from app.services.playback_service import PlaybackService

router = APIRouter(prefix="/playback", tags=["playback"])


@router.put("/sources/{source_id}/progress", response_model=PlaybackProgressResponse)
async def update_source_playback_progress(
    source_id: int,
    payload: PlaybackProgressRequest,
    user_id: Annotated[str, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
    service: Annotated[PlaybackService, Depends(playback_service)],
) -> PlaybackProgressResponse:
    return await service.update_progress(db, user_id=user_id, source_id=source_id, payload=payload)
