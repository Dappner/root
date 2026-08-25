"""AssemblyAI transcription client.

Wraps the AssemblyAI SDK so callers never import `assemblyai` directly. Returns
plain dicts in our standard transcript shape; raises `ExternalServiceError` on
provider failure.
"""

from __future__ import annotations

import asyncio
from typing import Any

import assemblyai as aai

from app.core.exceptions import ExternalServiceError

MILLISECONDS_PER_SECOND = 1000.0


class AssemblyAIClient:
    """Singleton client for AssemblyAI transcription."""

    def __init__(self, api_key: str) -> None:
        self._api_key = api_key.strip()
        if self._api_key:
            aai.settings.api_key = self._api_key

    @property
    def is_configured(self) -> bool:
        return bool(self._api_key)

    def _require_configured(self) -> None:
        if not self.is_configured:
            raise ExternalServiceError("assemblyai", "API key not configured")

    async def transcribe(
        self,
        source: str,
        *,
        speaker_labels: bool = False,
    ) -> dict[str, Any]:
        """Transcribe an audio source (file path or URL).

        Returns the full structured transcript when `speaker_labels=True`
        (utterances + speakers + metadata). For simple transcripts, callers
        typically only read `text`, `confidence`, `audio_duration`.
        """
        self._require_configured()

        transcriber = aai.Transcriber()
        config = aai.TranscriptionConfig(speaker_labels=speaker_labels)
        transcript = await asyncio.to_thread(transcriber.transcribe, source, config)

        if transcript.status == aai.TranscriptStatus.error:
            raise ExternalServiceError("assemblyai", f"transcription failed: {transcript.error}")

        return _format_transcript(transcript)


def _format_transcript(transcript: aai.Transcript) -> dict[str, Any]:
    """Format an AssemblyAI transcript into our standard shape."""
    data: dict[str, Any] = {
        "text": transcript.text or "",
        "full_text": transcript.text or "",
        "utterances": [],
        "speakers": {},
        "confidence": getattr(transcript, "confidence", None),
        "audio_duration": getattr(transcript, "audio_duration", None),
        "metadata": {
            "id": transcript.id,
            "audio_duration": getattr(transcript, "audio_duration", None),
            "confidence": getattr(transcript, "confidence", None),
        },
    }

    if transcript.utterances:
        for utterance in transcript.utterances:
            data["utterances"].append(
                {
                    "text": utterance.text,
                    "start": utterance.start / MILLISECONDS_PER_SECOND,
                    "end": utterance.end / MILLISECONDS_PER_SECOND,
                    "confidence": utterance.confidence,
                    "speaker": utterance.speaker,
                }
            )

            if utterance.speaker not in data["speakers"]:
                data["speakers"][utterance.speaker] = {
                    "id": utterance.speaker,
                    "utterance_count": 0,
                }
            data["speakers"][utterance.speaker]["utterance_count"] += 1

    return data
