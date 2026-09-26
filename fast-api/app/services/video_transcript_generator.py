"""Video transcript generation: YouTube captions + R2 storage.

The shared state machine lives in TranscriptPipeline; this module adds the
video specifics — caption fetching via `integrations.youtube` and formatting
the raw entries into our standard transcript shape.
"""

import logging
import re
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.core.exceptions import ExternalServiceError
from app.integrations.youtube import YouTubeTranscriptClient
from app.providers.object_store import ObjectStore
from app.repositories.source_repository import TranscriptStatus
from app.services.transcript_pipeline import TranscriptPipeline

logger = logging.getLogger(__name__)

YOUTUBE_MIN_WORDS_PER_UTTERANCE = 80


def _word_count(text: str) -> int:
    return len(text.split())


def _clean_youtube_text(text: str) -> str:
    """Clean YouTube caption text by removing common artifacts and markers.

    Removes:
    - Speaker change markers (>>, ->)
    - Music notation (♪)
    - Sound effect labels ([Music], [Applause], etc.)
    - Extra whitespace
    """
    # Remove speaker change markers
    text = text.replace(">>", "")
    text = text.replace("->", "")

    # Remove music notation
    text = text.replace("♪", "")

    # Remove bracketed sound effects like [Music], [Applause], [Laughter], etc.
    text = re.sub(r"\[.*?\]", "", text)

    # Remove parenthetical sound effects like (Music), (laughs), etc.
    text = re.sub(r"\(.*?\)", "", text)

    # Clean up extra whitespace
    text = re.sub(r"\s+", " ", text)
    text = text.strip()

    return text


def _make_youtube_utterance(entries: list[dict]) -> dict:
    return {
        "text": " ".join(entry["text"] for entry in entries),
        "start": entries[0]["start"],
        "end": entries[-1]["end"],
        "confidence": None,  # YouTube doesn't provide confidence
        "speaker": None,  # YouTube captions don't have speaker info
    }


def _format_youtube_transcript(entries: list[dict]) -> dict:
    """Format YouTube transcript into our standard format.

    YouTube transcript format: [{"text": "...", "start": 0.0, "duration": 3.5}, ...]

    Our format matches the podcast transcript format for frontend consistency.
    """
    full_text_parts = []
    utterances = []
    current_entries = []
    current_words = 0
    segment_count = 0

    for entry in entries:
        raw_text = entry.get("text", "")
        cleaned_text = _clean_youtube_text(raw_text)

        # Skip empty entries after cleaning
        if not cleaned_text:
            continue

        start = entry.get("start", 0)
        duration = entry.get("duration", 0)
        end = start + duration

        full_text_parts.append(cleaned_text)
        segment_count += 1

        current_entries.append({"text": cleaned_text, "start": start, "end": end})
        current_words += _word_count(cleaned_text)

        if current_words >= YOUTUBE_MIN_WORDS_PER_UTTERANCE:
            utterances.append(_make_youtube_utterance(current_entries))
            current_entries = []
            current_words = 0

    if current_entries:
        if utterances and current_words < YOUTUBE_MIN_WORDS_PER_UTTERANCE:
            utterances[-1]["text"] = (
                f"{utterances[-1]['text']} {' '.join(entry['text'] for entry in current_entries)}"
            )
            utterances[-1]["end"] = current_entries[-1]["end"]
        else:
            utterances.append(_make_youtube_utterance(current_entries))

    return {
        "full_text": " ".join(full_text_parts),
        "utterances": utterances,
        "speakers": {},  # YouTube captions don't have speaker diarization
        "metadata": {
            "source": "youtube_captions",
            "segment_count": segment_count,
            "utterance_count": len(utterances),
            "min_words_per_utterance": YOUTUBE_MIN_WORDS_PER_UTTERANCE,
        },
    }


class VideoTranscriptGenerator(TranscriptPipeline):
    """Generates video transcripts from YouTube captions and stores them in R2."""

    entity_name = "video"
    r2_prefix = "videos"

    def __init__(
        self,
        session_factory: async_sessionmaker[AsyncSession],
        r2_client: ObjectStore,
        youtube_client: YouTubeTranscriptClient,
        embedding_service: Any = None,
        sectioning_service: Any = None,
    ):
        super().__init__(session_factory, r2_client, embedding_service, sectioning_service)
        self.youtube_client = youtube_client

    # ----- pipeline hooks -----

    async def _get_entity(self, db: AsyncSession, entity_id: int) -> Any:
        return await self._repo.get_video(db, entity_id)

    async def _get_entity_locked(self, db: AsyncSession, entity_id: int) -> Any:
        return await self._repo.get_video_locked(db, entity_id)

    async def _update_status_row(
        self,
        db: AsyncSession,
        entity_id: int,
        status: TranscriptStatus,
        *,
        source: str | None,
        error: str | None,
        **extra: Any,
    ) -> None:
        await self._repo.update_video_status(db, entity_id, status, source=source, error=error)

    async def _list_sources(self, db: AsyncSession, entity_id: int) -> list[Any]:
        return await self._repo.list_sources_for_video(db, entity_id)

    async def _get_source(self, db: AsyncSession, entity_id: int) -> Any:
        return await self._repo.get_source_for_video(db, entity_id)

    def _validate_prerequisites(self, entity: Any) -> str | None:
        if not self.r2_client.is_available():
            return "R2 storage not configured"
        if entity.platform != "youtube":
            return f"Unsupported platform: {entity.platform}"
        return None

    def _process_arg(self, entity: Any) -> Any:
        return entity.platform_id

    async def _produce_transcript(
        self, entity_id: int, process_arg: Any
    ) -> tuple[dict, str | None, dict[str, Any]]:
        youtube_video_id: str = process_arg
        entries = await self.youtube_client.fetch_transcript(youtube_video_id)
        if entries is None:
            raise ExternalServiceError("youtube", "no transcript source available")
        return _format_youtube_transcript(entries), "youtube_captions", {}

    async def _embed_metadata(self, db: AsyncSession, entity_id: int) -> dict[str, Any]:
        video = await self._repo.get_video(db, entity_id)
        published_at = (
            video.published_at.strftime("%Y-%m-%d") if video and video.published_at else None
        )
        return {
            "episode_title": None,
            "show_title": None,
            "published_at": published_at,
        }


_generator = None


def get_video_transcript_generator() -> VideoTranscriptGenerator:
    """Get singleton video transcript generator instance."""
    from app.clients import embedder, object_store, youtube
    from app.core.config import settings
    from app.core.database import AsyncSessionLocal
    from app.services.transcript_embedding_service import TranscriptEmbeddingService
    from app.services.transcript_sectioning_service import TranscriptSectioningService

    global _generator
    if _generator is None:
        try:
            embedding_service = TranscriptEmbeddingService(embedder)
        except Exception as e:
            logger.warning("Embedder not available — video transcript embedding disabled: %s", e)
            embedding_service = None

        sectioning_service = TranscriptSectioningService(
            session_factory=AsyncSessionLocal,
            llm_api_key=settings.google_api_key,
        )

        _generator = VideoTranscriptGenerator(
            session_factory=AsyncSessionLocal,
            r2_client=object_store,
            youtube_client=youtube,
            embedding_service=embedding_service,
            sectioning_service=sectioning_service,
        )
    return _generator
