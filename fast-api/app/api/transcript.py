from typing import Annotated, Any

from fastapi import BackgroundTasks, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user_id, require_admin_user
from app.core.database import get_db
from app.core.routing import APIRouter
from app.schemas.transcript import (
    BackfillCitationSectionsResponse,
    BackfillSectionsRequest,
    BackfillSectionsResponse,
    GenerateTranscriptRequest,
    GenerateTranscriptResponse,
    GenerateVideoTranscriptRequest,
    TranscriptData,
)
from app.services.transcript_generator import get_transcript_generator
from app.services.video_transcript_generator import get_video_transcript_generator

router = APIRouter(prefix="/transcript", tags=["transcript"])


@router.post("/generate", response_model=GenerateTranscriptResponse)
async def generate_transcript(
    request: GenerateTranscriptRequest,
    background_tasks: BackgroundTasks,
    user_id: Annotated[str, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db, scope="function")],
) -> Any:
    """Generate a transcript for a podcast episode.

    Podcasts are syndicated content shared by all users; we don't enforce per-user
    ownership here. Any authenticated user can request generation for a given episode.
    """
    return await get_transcript_generator().generate_transcript(
        request.episode_id, db, background_tasks
    )


@router.get("/{episode_id}", response_model=GenerateTranscriptResponse)
async def get_transcript_status(
    episode_id: int,
    user_id: Annotated[str, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Any:
    return await get_transcript_generator().get_transcript_status(episode_id, db)


@router.get("/{episode_id}/audio-url")
async def get_episode_audio_url(
    episode_id: int,
    user_id: Annotated[str, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict[str, str | None]:
    """Get a fresh URL for the archived audio of a podcast episode.

    Returns url=null when no archived audio exists; client should fall back to enclosure_url.
    """
    return await get_transcript_generator().get_audio_url(episode_id, db)


@router.post(
    "/sections/backfill",
    response_model=BackfillSectionsResponse,
    operation_id="backfillSourceSections",
    deprecated=True,
)
async def backfill_source_sections(
    request: BackfillSectionsRequest,
    background_tasks: BackgroundTasks,
    user_id: Annotated[str, Depends(require_admin_user)],
    db: Annotated[AsyncSession, Depends(get_db, scope="function")],
) -> Any:
    """**DEPRECATED** — kept for ad-hoc admin use; backfill should be complete in prod.

    Queue auto-sectioning for every transcribed podcast missing sections (admin only).
    """
    return await get_transcript_generator().backfill_sections(
        db, background_tasks, force=request.force
    )


@router.post(
    "/sections/backfill-citations",
    response_model=BackfillCitationSectionsResponse,
    operation_id="backfillCitationSections",
    deprecated=True,
)
async def backfill_citation_sections(
    user_id: Annotated[str, Depends(require_admin_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Any:
    """**DEPRECATED** — one-shot migration that has already converged in prod.

    Re-assign every AV citation (and its captures) to the section containing its
    start timestamp. Idempotent — re-running converges to the same state. Admin only.
    """
    return await get_transcript_generator().backfill_citation_sections(db)


@router.post("/{episode_id}/embed", response_model=GenerateTranscriptResponse)
async def embed_transcript(
    episode_id: int,
    background_tasks: BackgroundTasks,
    user_id: Annotated[str, Depends(require_admin_user)],
    db: Annotated[AsyncSession, Depends(get_db, scope="function")],
) -> Any:
    """Trigger embedding for an already-transcribed episode (admin only)."""
    return await get_transcript_generator().embed_transcript(episode_id, db, background_tasks)


@router.get("/{episode_id}/content", response_model=TranscriptData)
async def get_transcript_content(
    episode_id: int,
    user_id: Annotated[str, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Any:
    return await get_transcript_generator().get_transcript_content(episode_id, db)


# ============================================================================
# Video Transcript Endpoints
# ============================================================================


@router.post("/video/generate", response_model=GenerateTranscriptResponse)
async def generate_video_transcript(
    request: GenerateVideoTranscriptRequest,
    background_tasks: BackgroundTasks,
    user_id: Annotated[str, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db, scope="function")],
) -> Any:
    """Generate a transcript for a video using YouTube captions or AssemblyAI."""
    return await get_video_transcript_generator().generate_transcript(
        request.video_id, db, background_tasks
    )


@router.get("/video/{video_id}", response_model=GenerateTranscriptResponse)
async def get_video_transcript_status(
    video_id: int,
    user_id: Annotated[str, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Any:
    return await get_video_transcript_generator().get_transcript_status(video_id, db)


@router.get("/video/{video_id}/content", response_model=TranscriptData)
async def get_video_transcript_content(
    video_id: int,
    user_id: Annotated[str, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Any:
    return await get_video_transcript_generator().get_transcript_content(video_id, db)
