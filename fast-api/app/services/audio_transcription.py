import logging
import tempfile
from pathlib import Path
from typing import Any

from fastapi import UploadFile

from app.clients import assemblyai
from app.core.exceptions import ValidationError

logger = logging.getLogger(__name__)

MAX_AUDIO_BYTES = 25 * 1024 * 1024
CHUNK_SIZE = 1024 * 1024


class AudioTranscriptionService:
    """Handles audio upload buffering and delegates transcription to AssemblyAI."""

    async def transcribe_upload(self, audio: UploadFile) -> dict[str, Any]:
        suffix = Path(audio.filename or "voice-note.webm").suffix or ".webm"
        temp_path: str | None = None

        try:
            with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
                temp_path = temp_file.name
                total_bytes = 0

                while chunk := await audio.read(CHUNK_SIZE):
                    total_bytes += len(chunk)
                    if total_bytes > MAX_AUDIO_BYTES:
                        raise ValidationError("Audio file is too large")
                    temp_file.write(chunk)

            if not temp_path or Path(temp_path).stat().st_size == 0:
                raise ValidationError("Audio file is empty")

            result = await assemblyai.transcribe(temp_path, speaker_labels=False)
            return {
                "transcript": result["text"],
                "provider": "assemblyai",
                "confidence": result["confidence"],
                "duration_seconds": result["audio_duration"],
            }
        finally:
            await audio.close()
            if temp_path:
                try:
                    Path(temp_path).unlink(missing_ok=True)
                except OSError:
                    logger.warning("Failed to remove temporary audio file: %s", temp_path)

    async def transcribe_url(self, url: str) -> dict[str, Any]:
        result = await assemblyai.transcribe(url, speaker_labels=False)
        return {
            "transcript": result["text"],
            "provider": "assemblyai",
            "confidence": result["confidence"],
            "duration_seconds": result["audio_duration"],
        }


_service: AudioTranscriptionService | None = None


def get_audio_transcription_service() -> AudioTranscriptionService:
    global _service
    if _service is None:
        _service = AudioTranscriptionService()
    return _service
