"""Shared transcript-generation pipeline for media entities.

Podcast episodes and videos share one state machine
(none → pending → transcribed → embedded | failed) and one persistence shape:
transcript JSON in R2 under ``<prefix>/<id>/transcript.json`` plus
``transcript_status`` / ``transcript_error`` columns on the entity row.

Subclasses supply entity access and the actual transcript production via the
hook methods; status transitions, R2 persistence, auto-sectioning, and
embedding orchestration live here. Adding a new transcribable media type means
implementing the hooks, not copying the pipeline.
"""

import logging
from abc import ABC, abstractmethod
from typing import Any

from fastapi import BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.core.exceptions import ExternalServiceError, NotFoundError, ValidationError
from app.providers.object_store import ObjectStore, ObjectStoreError, read_json
from app.repositories.source_repository import SourceRepository, TranscriptStatus

logger = logging.getLogger(__name__)

MAX_ERROR_LENGTH = 500


class TranscriptPipeline(ABC):
    """Template for media transcript generation (podcast episodes, videos)."""

    #: Human/log name of the entity, e.g. "episode" or "video".
    entity_name: str
    #: R2 key prefix, e.g. "podcasts" or "videos".
    r2_prefix: str

    def __init__(
        self,
        session_factory: async_sessionmaker[AsyncSession],
        r2_client: ObjectStore,
        embedding_service: Any = None,
        sectioning_service: Any = None,
    ):
        self.session_factory = session_factory
        self.r2_client = r2_client
        self.embedding_service = embedding_service
        self.sectioning_service = sectioning_service
        self._repo = SourceRepository()

    # ------------------------------------------------------------------
    # Subclass hooks
    # ------------------------------------------------------------------

    @abstractmethod
    async def _get_entity(self, db: AsyncSession, entity_id: int) -> Any:
        """Load the entity row, or None."""

    @abstractmethod
    async def _get_entity_locked(self, db: AsyncSession, entity_id: int) -> Any:
        """Load the entity row with a row lock for the status transition."""

    @abstractmethod
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
        """Persist a status update via the repository."""

    @abstractmethod
    async def _list_sources(self, db: AsyncSession, entity_id: int) -> list[Any]:
        """All user-owned sources linked to this entity (for sectioning)."""

    @abstractmethod
    async def _get_source(self, db: AsyncSession, entity_id: int) -> Any:
        """One linked source (for embedding), or None."""

    @abstractmethod
    def _validate_prerequisites(self, entity: Any) -> str | None:
        """Return an error message if generation cannot start, else None."""

    @abstractmethod
    def _process_arg(self, entity: Any) -> Any:
        """Entity-specific value forwarded to ``_produce_transcript``."""

    @abstractmethod
    async def _produce_transcript(
        self, entity_id: int, process_arg: Any
    ) -> tuple[dict, str | None, dict[str, Any]]:
        """Produce the transcript in the background task.

        Returns ``(transcript_data, source_label, status_extra)`` where
        ``status_extra`` is merged into the "transcribed" status update
        (e.g. the archived audio key for podcasts).
        """

    @abstractmethod
    async def _embed_metadata(self, db: AsyncSession, entity_id: int) -> dict[str, Any]:
        """Title/date kwargs passed to ``embed_episode_transcript``."""

    # ------------------------------------------------------------------
    # Shared pipeline
    # ------------------------------------------------------------------

    def _transcript_key(self, entity_id: int) -> str:
        return f"{self.r2_prefix}/{entity_id}/transcript.json"

    async def generate_transcript(
        self, entity_id: int, db: AsyncSession, background_tasks: BackgroundTasks
    ) -> dict[str, str | None]:
        """Kick off transcript generation for one entity.

        Validates state and prerequisites, marks the row pending, and schedules
        the actual work as a background task so the request returns immediately.
        """
        logger.info(f"Starting transcript generation for {self.entity_name} {entity_id}")

        entity = await self._get_entity_locked(db, entity_id)
        if not entity:
            raise NotFoundError(self.entity_name, entity_id)

        if entity.transcript_status == "pending":
            logger.info(f"{self.entity_name} {entity_id} transcript generation already in progress")
            return {"status": "pending", "url": None}

        if entity.transcript_status in ("transcribed", "embedded"):
            logger.info(f"{self.entity_name} {entity_id} transcript already completed")
            url = self.r2_client.get_public_url(self._transcript_key(entity_id))
            return {"status": entity.transcript_status, "url": url}

        prerequisite_error = self._validate_prerequisites(entity)
        if prerequisite_error is not None:
            entity.transcript_status = "failed"
            entity.transcript_error = prerequisite_error
            await db.commit()
            return {"status": "failed", "url": None}

        entity.transcript_status = "pending"
        entity.transcript_error = None
        # Must commit (not flush) before scheduling: FastAPI runs BackgroundTasks
        # before get_db's teardown commit, and _process_transcript opens its own
        # session that reads/locks this same row. Flushing would leave the row
        # locked + uncommitted, hanging the background task on get_db teardown.
        await db.commit()

        # TODO: Long term production queue
        background_tasks.add_task(self._process_transcript, entity_id, self._process_arg(entity))

        return {"status": "pending", "url": None}

    async def get_transcript_status(
        self, entity_id: int, db: AsyncSession
    ) -> dict[str, str | None]:
        """Report transcript status plus a URL once one exists."""
        entity = await self._get_entity(db, entity_id)
        if not entity:
            raise NotFoundError(self.entity_name, entity_id)

        url = None
        if entity.transcript_status in ("transcribed", "embedded"):
            url = self.r2_client.get_public_url(self._transcript_key(entity_id))

        return {"status": entity.transcript_status, "url": url}

    async def get_transcript_content(self, entity_id: int, db: AsyncSession) -> dict:
        """Fetch the full transcript JSON from R2."""
        entity = await self._get_entity(db, entity_id)
        if not entity:
            raise NotFoundError(self.entity_name, entity_id)

        if entity.transcript_status not in ("transcribed", "embedded"):
            status = entity.transcript_status
            if status == "pending":
                message = "Transcript generation in progress. Please check back in a few minutes."
            elif status == "failed":
                message = (
                    "Transcript generation failed. Please try generating again or contact support."
                )
            elif status == "none":
                message = (
                    f"No transcript has been generated for this {self.entity_name} yet. "
                    "Please generate one first."
                )
            else:
                message = f"Transcript not ready. Current status: {status}"
            raise ValidationError(message)

        try:
            transcript_data: dict[str, Any] = await read_json(
                self.r2_client, self._transcript_key(entity_id)
            )
            return transcript_data
        except ObjectStoreError as e:
            raise ExternalServiceError("r2", f"failed to fetch transcript: {str(e)}") from e

    async def _update_status(
        self,
        entity_id: int,
        status: TranscriptStatus,
        *,
        source: str | None = None,
        error: str | None = None,
        **extra: Any,
    ) -> None:
        """Status update from a background task — owns its own session."""
        async with self.session_factory() as db:
            await self._update_status_row(
                db, entity_id, status, source=source, error=error, **extra
            )
            await db.commit()
            logger.info(f"Updated {self.entity_name} {entity_id} status to {status}")

    async def _process_transcript(self, entity_id: int, process_arg: Any) -> None:
        """Background task: produce → persist → section → embed.

        Runs independently of the triggering request; any failure flips the
        row to "failed" with a truncated error message.
        """
        try:
            logger.info(f"Processing transcript for {self.entity_name} {entity_id}")

            transcript_data, source_label, status_extra = await self._produce_transcript(
                entity_id, process_arg
            )

            r2_key = self._transcript_key(entity_id)
            self.r2_client.upload_json(r2_key, transcript_data)

            await self._update_status(
                entity_id,
                status="transcribed",
                source=source_label,
                error=None,
                **status_extra,
            )
            logger.info(f"Transcript completed for {self.entity_name} {entity_id}: {r2_key}")

            # Best-effort; failures don't block embedding.
            await self._auto_section(entity_id, transcript_data)

            await self._embed_transcript(entity_id, transcript_data)

        except Exception as e:
            logger.error(
                f"Failed to process transcript for {self.entity_name} {entity_id}: {e}",
                exc_info=True,
            )
            try:
                await self._update_status(
                    entity_id,
                    status="failed",
                    source=None,
                    error=str(e)[:MAX_ERROR_LENGTH],
                )
            except Exception as db_error:
                logger.error(
                    f"Failed to update database with error status for "
                    f"{self.entity_name} {entity_id}: {db_error}"
                )

    async def _auto_section(self, entity_id: int, transcript_data: dict) -> None:
        """Generate semantic section headers for the transcript.

        Entities can be linked from multiple user-owned sources (each user has
        their own row pointing at the same shared entity). The LLM runs once
        against the shared transcript; the resulting sections are written to
        every linked source.

        Best-effort: any failure is logged and swallowed so the embedding step
        still runs.
        """
        if not self.sectioning_service:
            return

        try:
            async with self.session_factory() as db:
                sources = await self._list_sources(db, entity_id)
            if not sources:
                logger.info(
                    "No sources for %s %s — skipping auto-sectioning",
                    self.entity_name,
                    entity_id,
                )
                return

            await self.sectioning_service.generate(
                [s.id for s in sources], transcript_data.get("utterances") or []
            )
        except Exception as e:
            logger.warning(
                "Auto-sectioning failed for %s %s: %s",
                self.entity_name,
                entity_id,
                e,
                exc_info=True,
            )

    async def _embed_transcript(self, entity_id: int, transcript_data: dict) -> None:
        """Chunk and embed the transcript, then mark the entity as embedded."""
        if not self.embedding_service:
            logger.info("No embedding service configured — skipping transcript embedding")
            return

        try:
            async with self.session_factory() as db:
                source = await self._get_source(db, entity_id)
                if not source:
                    logger.warning(
                        "No source found for %s %s — skipping embedding",
                        self.entity_name,
                        entity_id,
                    )
                    return

                metadata = await self._embed_metadata(db, entity_id)
                await self.embedding_service.embed_episode_transcript(
                    source_id=source.id,
                    transcript_data=transcript_data,
                    db=db,
                    **metadata,
                )
                await db.commit()

            await self._update_status(entity_id, status="embedded")
            logger.info("Transcript embedding completed for %s %s", self.entity_name, entity_id)

        except Exception as e:
            logger.error(
                "Failed to embed transcript for %s %s: %s",
                self.entity_name,
                entity_id,
                e,
                exc_info=True,
            )
            # Leave status as 'transcribed' — transcript is usable, embedding
            # can be retried.
