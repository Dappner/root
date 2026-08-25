from typing import Annotated, Any

from fastapi import Depends, File, UploadFile

from app.core.auth import get_current_user_id
from app.core.routing import APIRouter
from app.deps import audio_transcription_service
from app.schemas.audio import AudioTranscribeResponse
from app.services.audio_transcription import AudioTranscriptionService

router = APIRouter(prefix="/audio", tags=["audio"])


@router.post("/transcribe", response_model=AudioTranscribeResponse)
async def transcribe_audio(
    audio: Annotated[UploadFile, File()],
    user_id: Annotated[str, Depends(get_current_user_id)],
    service: Annotated[AudioTranscriptionService, Depends(audio_transcription_service)],
) -> Any:
    return await service.transcribe_upload(audio)
