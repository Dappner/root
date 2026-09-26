"""Hydrates transcript chunk hits with text read from object storage."""

from __future__ import annotations

import logging

from app.providers.object_store import ObjectStore, read_json
from app.services.transcript_embedding_service import TranscriptChunk, _build_chunks

logger = logging.getLogger(__name__)


class TranscriptChunkHydrator:
    """Reads transcript JSON from object storage and extracts chunk text by index."""

    def __init__(self, r2_client: ObjectStore) -> None:
        self._r2 = r2_client
        # Cache transcripts within a single hydration call (source_id → chunks)
        self._cache: dict[int, list[TranscriptChunk]] = {}

    async def hydrate(
        self,
        requests: list[
            tuple[int, int, int | None, int | None]
        ],  # (source_id, chunk_index, episode_id, video_id)
    ) -> dict[tuple[int, int], TranscriptChunk | None]:
        """Return chunk text/metadata keyed by (source_id, chunk_index).

        Fetches each transcript JSON from R2 once per source, then
        reconstructs chunks using the same logic used at embed time.
        """
        source_to_media: dict[int, tuple[int | None, int | None]] = {}
        for source_id, _, episode_id, video_id in requests:
            source_to_media[source_id] = (episode_id, video_id)

        # Fetch and parse each unique transcript once
        for source_id, (episode_id, video_id) in source_to_media.items():
            if source_id in self._cache:
                continue
            if episode_id is not None:
                r2_key = f"podcasts/{episode_id}/transcript.json"
            elif video_id is not None:
                r2_key = f"videos/{video_id}/transcript.json"
            else:
                logger.warning(
                    "No episode_id or video_id for source %s — cannot fetch transcript",
                    source_id,
                )
                self._cache[source_id] = []
                continue
            try:
                transcript_data = await read_json(self._r2, r2_key)
                utterances = transcript_data.get("utterances", [])
                self._cache[source_id] = _build_chunks(utterances)
            except Exception as e:
                logger.error(
                    "Failed to fetch transcript for source %s (%s): %s",
                    source_id,
                    r2_key,
                    e,
                )
                self._cache[source_id] = []

        result: dict[tuple[int, int], TranscriptChunk | None] = {}
        for source_id, chunk_index, _, _ in requests:
            chunks = self._cache.get(source_id, [])
            match = next((c for c in chunks if c.chunk_index == chunk_index), None)
            result[(source_id, chunk_index)] = match

        return result
