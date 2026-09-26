"""Generates and stores embeddings for transcript chunks."""

from __future__ import annotations

import logging
from dataclasses import dataclass

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.hashing import sha256_hex
from app.providers.embedder import Embedder
from app.repositories.transcript_embedding_repository import TranscriptEmbeddingRepository

logger = logging.getLogger(__name__)

# Target token budget per chunk. Utterances are grouped greedily until this
# character count is reached (rough proxy for tokens at ~4 chars/token).
CHUNK_TARGET_CHARS = 1200


@dataclass
class TranscriptChunk:
    chunk_index: int
    text: str  # raw utterance text concatenated
    speakers: list[str]
    start: float
    end: float


def _build_chunks(
    utterances: list[dict], target_chars: int = CHUNK_TARGET_CHARS
) -> list[TranscriptChunk]:
    """Group utterances into fixed-size chunks."""
    chunks: list[TranscriptChunk] = []
    current: list[dict] = []
    current_chars = 0

    for utt in utterances:
        utt_len = len(utt.get("text", ""))
        # Start a new chunk when we exceed the budget and already have content
        if current and current_chars + utt_len > target_chars:
            chunks.append(_make_chunk(len(chunks), current))
            current = []
            current_chars = 0
        current.append(utt)
        current_chars += utt_len

    if current:
        chunks.append(_make_chunk(len(chunks), current))

    return chunks


def _make_chunk(index: int, utterances: list[dict]) -> TranscriptChunk:
    text = " ".join(u.get("text", "") for u in utterances).strip()
    speakers = list(dict.fromkeys(u.get("speaker", "") for u in utterances if u.get("speaker")))
    return TranscriptChunk(
        chunk_index=index,
        text=text,
        speakers=speakers,
        start=utterances[0].get("start", 0.0),
        end=utterances[-1].get("end", 0.0),
    )


def _build_embedding_document(
    chunk: TranscriptChunk,
    source_title: str,
    episode_title: str | None,
    show_title: str | None,
    published_at: str | None,
) -> str:
    lines: list[str] = ["Content type: transcript chunk"]
    if show_title:
        lines.append(f"Show: {show_title}")
    if episode_title:
        lines.append(f"Episode: {episode_title}")
    lines.append(f"Source: {source_title}")
    if published_at:
        lines.append(f"Published: {published_at}")
    if chunk.speakers:
        lines.append(f"Speaker(s): {', '.join(chunk.speakers)}")
    lines.append(f"Timestamp: {chunk.start:.1f}s – {chunk.end:.1f}s")
    lines.append(f"Transcript: {chunk.text}")
    return "\n".join(lines)


class TranscriptEmbeddingService:
    def __init__(
        self,
        embedder: Embedder,
        repo: TranscriptEmbeddingRepository | None = None,
    ) -> None:
        self._embedder = embedder
        self._repo = repo or TranscriptEmbeddingRepository()

    async def embed_episode_transcript(
        self,
        *,
        source_id: int,
        transcript_data: dict,
        db: AsyncSession,
        episode_title: str | None = None,
        show_title: str | None = None,
        published_at: str | None = None,
    ) -> int:
        """Chunk, embed, and store transcript for a source. Returns number of chunks written."""
        utterances: list[dict] = transcript_data.get("utterances", [])
        if not utterances:
            logger.warning("No utterances found for source %s — skipping embedding", source_id)
            return 0

        source = await self._repo.get_source(db, source_id)
        if not source:
            raise ValueError(f"Source {source_id} not found")

        chunks = _build_chunks(utterances)
        logger.info("Embedding %d transcript chunks for source %s", len(chunks), source_id)

        documents = [
            _build_embedding_document(
                chunk,
                source_title=source.title,
                episode_title=episode_title,
                show_title=show_title,
                published_at=published_at,
            )
            for chunk in chunks
        ]

        vectors = await self._embedder.embed_documents(documents)

        if len(vectors) != len(chunks):
            raise RuntimeError(
                f"Embedder returned {len(vectors)} embeddings for {len(chunks)} chunks"
            )

        # Delete existing chunk embeddings for this source before re-inserting
        await self._repo.delete_chunks_for_source(db, source_id)

        rows = [
            {
                "source_id": source_id,
                "chunk_index": chunk.chunk_index,
                "content_sha256": sha256_hex(doc),
                "embedding": vectors[i],
                "model": settings.embedding_model,
            }
            for i, (chunk, doc) in enumerate(zip(chunks, documents))
        ]
        await self._repo.insert_chunks(db, rows)

        logger.info("Stored %d chunk embeddings for source %s", len(rows), source_id)
        return len(rows)
