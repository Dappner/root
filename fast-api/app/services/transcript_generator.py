"""Podcast transcript generation: AssemblyAI transcription + R2 storage.

The shared state machine lives in TranscriptPipeline; this module adds the
podcast specifics — audio archival before transcription, AssemblyAI, and the
episode-level backfill endpoints.
"""

import asyncio
import logging
import tempfile
from typing import Any

import httpx
from fastapi import BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.core.exceptions import ExternalServiceError, NotFoundError, ValidationError
from app.integrations.assemblyai import AssemblyAIClient
from app.integrations.r2 import R2Client
from app.repositories.source_repository import TranscriptStatus
from app.repositories.source_section_repository import SourceSectionRepository
from app.repositories.transcript_backfill_repository import TranscriptBackfillRepository
from app.services.transcript_pipeline import MAX_ERROR_LENGTH, TranscriptPipeline

__all__ = ["MAX_ERROR_LENGTH", "TranscriptGenerator", "get_transcript_generator"]

logger = logging.getLogger(__name__)

ARCHIVE_CHUNK_SIZE = 1024 * 1024
ARCHIVE_SPOOL_MAX_MEMORY = 8 * 1024 * 1024


class TranscriptGenerator(TranscriptPipeline):
    """Generates podcast transcripts using AssemblyAI and stores them in R2."""

    entity_name = "episode"
    r2_prefix = "podcasts"

    def __init__(
        self,
        session_factory: async_sessionmaker[AsyncSession],
        r2_client: R2Client,
        assemblyai_client: AssemblyAIClient,
        embedding_service: Any = None,
        sectioning_service: Any = None,
    ):
        super().__init__(session_factory, r2_client, embedding_service, sectioning_service)
        self.assemblyai_client = assemblyai_client

        if not self.assemblyai_client.is_configured:
            logger.warning("AssemblyAI API key not configured - transcript generation disabled")

    # ----- pipeline hooks -----

    async def _get_entity(self, db: AsyncSession, entity_id: int) -> Any:
        return await self._repo.get_episode(db, entity_id)

    async def _get_entity_locked(self, db: AsyncSession, entity_id: int) -> Any:
        return await self._repo.get_episode_locked(db, entity_id)

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
        await self._repo.update_episode_status(
            db,
            entity_id,
            status,
            source=source,
            error=error,
            r2_audio_key=extra.get("r2_audio_key"),
        )

    async def _list_sources(self, db: AsyncSession, entity_id: int) -> list[Any]:
        return await self._repo.list_sources_for_episode(db, entity_id)

    async def _get_source(self, db: AsyncSession, entity_id: int) -> Any:
        return await self._repo.get_source_for_episode(db, entity_id)

    def _validate_prerequisites(self, entity: Any) -> str | None:
        if not self.assemblyai_client.is_configured:
            return "AssemblyAI API key not configured"
        if not self.r2_client.is_available():
            return "R2 storage not configured"
        if not entity.enclosure_url:
            return "No audio URL available for this episode"
        return None

    def _process_arg(self, entity: Any) -> Any:
        return entity.enclosure_url

    async def _produce_transcript(
        self, entity_id: int, process_arg: Any
    ) -> tuple[dict, str | None, dict[str, Any]]:
        """Archive the source audio, then transcribe via AssemblyAI.

        Archival freezes the audio at transcription time so transcript
        timestamps stay accurate even if the original enclosure URL changes
        later (e.g. podcast ad updates). If archival fails we fall back to
        transcribing the original URL.
        """
        audio_url: str = process_arg
        r2_audio_key = f"{self.r2_prefix}/{entity_id}/audio.mp3"
        archived_key = await self._archive_audio_to_r2(audio_url, r2_audio_key)

        # Presigned URLs are publicly accessible (credentials embedded), so
        # AssemblyAI can fetch them without additional authentication.
        if archived_key:
            transcription_url = self.r2_client.get_public_url(archived_key)
        else:
            transcription_url = audio_url

        transcript_data = await self.assemblyai_client.transcribe(
            transcription_url, speaker_labels=True
        )
        return transcript_data, "assemblyai", {"r2_audio_key": archived_key}

    async def _embed_metadata(self, db: AsyncSession, entity_id: int) -> dict[str, Any]:
        episode = await self._repo.get_episode(db, entity_id)
        episode_title = episode.title if episode else None
        published_at = (
            episode.published_at.strftime("%Y-%m-%d") if episode and episode.published_at else None
        )
        return {
            "episode_title": episode_title,
            "show_title": None,  # would need a join to shows — omit for now
            "published_at": published_at,
        }

    # ----- podcast-specific operations -----

    async def embed_transcript(
        self, episode_id: int, db: AsyncSession, background_tasks: BackgroundTasks
    ) -> dict[str, str | None]:
        """Trigger embedding for an already-transcribed episode.

        Fetches the transcript from R2 and runs embedding as a background task.
        Only valid when transcript_status is 'transcribed'.
        """
        episode = await self._repo.get_episode(db, episode_id)
        if not episode:
            raise NotFoundError("episode", episode_id)

        if episode.transcript_status == "embedded":
            return {"status": "embedded", "url": None}

        if episode.transcript_status != "transcribed":
            raise ValidationError(
                f"Episode {episode_id} has status '{episode.transcript_status}'"
                " — must be 'transcribed' to embed"
            )

        transcript_url = self.r2_client.get_public_url(self._transcript_key(episode_id))

        async def _fetch_and_embed() -> None:
            try:
                async with httpx.AsyncClient(timeout=30.0) as client:
                    response = await client.get(transcript_url)
                    response.raise_for_status()
                    transcript_data = response.json()
                await self._embed_transcript(episode_id, transcript_data)
            except Exception as e:
                logger.error(
                    "Background embed failed for episode %s: %s", episode_id, e, exc_info=True
                )

        background_tasks.add_task(_fetch_and_embed)
        return {"status": "transcribed", "url": transcript_url}

    async def backfill_sections(
        self,
        db: AsyncSession,
        background_tasks: BackgroundTasks,
        force: bool = False,
    ) -> dict[str, int]:
        """Queue auto-sectioning for every transcribed episode missing sections.

        With force=False, episodes whose linked sources already have any
        generated_by='auto' rows are skipped. With force=True, every transcribed
        episode is re-sectioned (the underlying service deletes prior auto rows
        before insert, so this is idempotent).
        """
        section_repo = SourceSectionRepository()

        episode_ids = await self._repo.list_transcribed_episode_ids(db)

        candidates: list[int] = []
        skipped = 0
        for episode_id in episode_ids:
            if not force:
                if await section_repo.episode_has_auto_sections(db, episode_id):
                    skipped += 1
                    continue
            candidates.append(episode_id)

        async def _run_backfill() -> None:
            for episode_id in candidates:
                try:
                    async with self.session_factory() as bg_db:
                        transcript_data = await self.get_transcript_content(episode_id, bg_db)
                    await self._auto_section(episode_id, transcript_data)
                except Exception as e:
                    logger.warning(
                        "Backfill sectioning failed for episode %s: %s",
                        episode_id,
                        e,
                        exc_info=True,
                    )

        if candidates:
            background_tasks.add_task(_run_backfill)

        return {"queued": len(candidates), "skipped": skipped}

    async def backfill_citation_sections(self, db: AsyncSession) -> dict[str, int]:
        """Backfill citation section assignment for transcript and book sources.

        AV citations are matched by their start timestamp against podcast/video
        sections. Book citations are matched by ``location.book.pageStart``
        against book section page ranges. Linked captures inherit their
        citation's section in a final pass.

        Returns the number of citation and capture rows actually changed.
        """
        result = await TranscriptBackfillRepository().backfill_citation_sections(db)
        await db.flush()
        return {
            "citations_updated": result.citations_changed,
            "captures_updated": result.captures_changed,
        }

    async def get_audio_url(self, episode_id: int, db: AsyncSession) -> dict[str, str | None]:
        """Get a fresh URL for the archived audio of a podcast episode.

        Generates a URL on demand from the stored R2 key so that it never
        expires. If the episode has no archived audio, returns url=None.
        """
        episode = await self._repo.get_episode(db, episode_id)
        if not episode:
            raise NotFoundError("episode", episode_id)

        url = None
        if episode.r2_audio_key:
            url = self.r2_client.get_public_url(episode.r2_audio_key)

        return {"url": url}

    async def _archive_audio_to_r2(self, audio_url: str, r2_key: str) -> str | None:
        """Download audio from URL and upload to R2 for archival.

        Stores a frozen copy of the audio file so that transcript timestamps
        remain accurate even if the original source URL changes later.

        Returns the R2 key for the archived audio, or None if archival failed.
        The key is stable and can be used to generate fresh URLs on demand.
        """
        try:

            def _stream_upload_to_r2() -> tuple[str, int | None, int]:
                with httpx.Client(timeout=300.0, follow_redirects=True) as client:
                    with client.stream("GET", audio_url) as response:
                        response.raise_for_status()
                        content_type = response.headers.get("content-type", "audio/mpeg")
                        content_length_raw = response.headers.get("content-length")
                        content_length = (
                            int(content_length_raw)
                            if content_length_raw and content_length_raw.isdigit()
                            else None
                        )
                        bytes_downloaded = 0
                        # Keep small files in memory but spill to disk automatically for
                        # large files.
                        with tempfile.SpooledTemporaryFile(
                            max_size=ARCHIVE_SPOOL_MAX_MEMORY
                        ) as spool_file:
                            for chunk in response.iter_bytes(chunk_size=ARCHIVE_CHUNK_SIZE):
                                if not chunk:
                                    continue
                                spool_file.write(chunk)
                                bytes_downloaded += len(chunk)

                            if bytes_downloaded == 0:
                                raise ExternalServiceError("r2", "downloaded empty audio payload")

                            spool_file.seek(0)
                            self.r2_client.upload_stream(
                                r2_key, spool_file, content_type=content_type
                            )

                        return content_type, content_length, bytes_downloaded

            content_type, content_length, bytes_downloaded = await asyncio.to_thread(
                _stream_upload_to_r2
            )
            if content_length is not None and content_length != bytes_downloaded:
                logger.warning(
                    "Archived audio size mismatch for %s: header=%s downloaded=%s",
                    r2_key,
                    content_length,
                    bytes_downloaded,
                )
            logger.info(
                "Archived audio to R2: %s (%s bytes, content_type=%s)",
                r2_key,
                bytes_downloaded,
                content_type,
            )
            return r2_key
        except Exception as e:
            logger.warning(f"Failed to archive audio to R2 ({audio_url}): {e}")
            return None


_generator = None


def get_transcript_generator() -> TranscriptGenerator:
    """Get singleton transcript generator instance."""
    from app.clients import assemblyai, embedder, r2
    from app.core.config import settings
    from app.core.database import AsyncSessionLocal
    from app.services.transcript_embedding_service import TranscriptEmbeddingService
    from app.services.transcript_sectioning_service import TranscriptSectioningService

    global _generator
    if _generator is None:
        try:
            embedding_service = TranscriptEmbeddingService(embedder)
        except Exception as e:
            logger.warning("Embedder not available — transcript embedding disabled: %s", e)
            embedding_service = None

        sectioning_service = TranscriptSectioningService(
            session_factory=AsyncSessionLocal,
            llm_api_key=settings.google_api_key,
        )

        _generator = TranscriptGenerator(
            session_factory=AsyncSessionLocal,
            r2_client=r2,
            assemblyai_client=assemblyai,
            embedding_service=embedding_service,
            sectioning_service=sectioning_service,
        )
    return _generator
