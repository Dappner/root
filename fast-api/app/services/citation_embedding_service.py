"""On-demand embedding generation for citations and captures.

Fire-and-forget invocation from the citation service after create/update,
plus a batch refresh for stale embeddings.
"""

from __future__ import annotations

import asyncio

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.core.config import settings
from app.core.datetime_utils import utcnow
from app.core.logging import get_logger
from app.providers.embedder import Embedder
from app.repositories.citation_embedding_repository import (
    CaptureEmbeddingCandidate,
    CitationEmbeddingCandidate,
    CitationEmbeddingRepository,
    SourceEmbeddingContext,
)
from app.services._embedding_batch import PreparedEmbedding, refresh_stale_embeddings
from app.services._embedding_refresh import (
    DocumentField,
    generate_entity_embedding,
    render_embedding_document,
)

logger = get_logger(__name__)


def _source_fields(source: SourceEmbeddingContext, kind: str) -> list[DocumentField]:
    # status + label intentionally excluded: both mutate without changing
    # the entity content hash, which would leave embeddings stale until the
    # next natural edit. They also carry near-zero query-time retrieval
    # signal (users don't phrase questions in terms of source status or
    # label), so the cost-benefit is one-sided.
    return [
        ("Content type", kind),
        ("Source title", source.title),
        ("Source type", source.type),
        ("Source author", source.author),
        ("Source published date", source.published_at),
        ("Podcast episode", source.podcast_episode_title),
        ("Podcast show", source.podcast_show_title),
        ("Podcast show author", source.podcast_show_author),
        ("Podcast duration seconds", source.podcast_duration),
        ("Podcast published date", source.podcast_published_at),
        ("Video title", source.video_title),
        ("Video platform", source.video_platform),
        ("Video channel", source.video_channel_name),
        ("Video duration seconds", source.video_duration),
        ("Video published date", source.video_published_at),
    ]


def _citation_document(candidate: CitationEmbeddingCandidate) -> str:
    return render_embedding_document(
        [
            *_source_fields(candidate.source, "citation"),
            ("Speaker", candidate.speaker),
            ("Context", candidate.context),
            ("Citation", candidate.text),
        ]
    )


def _capture_document(candidate: CaptureEmbeddingCandidate) -> str:
    return render_embedding_document(
        [
            *_source_fields(candidate.source, "capture"),
            ("Note", candidate.content),
            ("Referenced citation speaker", candidate.citation_speaker),
            ("Referenced citation context", candidate.citation_context),
            ("Referenced citation", candidate.citation_text),
        ]
    )


class CitationEmbeddingService:
    """Generates and upserts embeddings for citations and captures.

    Routes invoke `generate_citation` / `generate_capture` via FastAPI
    BackgroundTasks after create/update; the admin endpoint calls
    `refresh_stale` to backfill.
    """

    def __init__(
        self,
        embedder: Embedder,
        session_factory: async_sessionmaker[AsyncSession],
        repository: CitationEmbeddingRepository | None = None,
    ):
        self._embedder = embedder
        self._session_factory = session_factory
        self._repo = repository or CitationEmbeddingRepository()

    # ----- Citations -----

    async def generate_citation(self, citation_id: int, user_id: str) -> None:
        await generate_entity_embedding(
            session_factory=self._session_factory,
            embedder=self._embedder,
            logger=logger,
            log_label="citation",
            log_extra={"citation_id": citation_id},
            get_candidate=lambda db: self._repo.get_citation_candidate(
                db, citation_id=citation_id, user_id=user_id
            ),
            content_hash=lambda row: row.content_sha256,
            build_document=_citation_document,
            upsert=lambda db, sha, vector: self._repo.upsert_citation_embedding(
                db,
                citation_id=citation_id,
                content_sha256=sha,
                embedding=vector,
                model=settings.embedding_model,
                created_at=utcnow(),
            ),
        )

    async def delete_citation(self, db: AsyncSession, citation_id: int) -> None:
        await self._repo.delete_citation_embedding(db, citation_id)

    # ----- Captures -----

    async def generate_capture(self, capture_id: int, user_id: str) -> None:
        await generate_entity_embedding(
            session_factory=self._session_factory,
            embedder=self._embedder,
            logger=logger,
            log_label="capture",
            log_extra={"capture_id": capture_id},
            get_candidate=lambda db: self._repo.get_capture_candidate(
                db, capture_id=capture_id, user_id=user_id
            ),
            content_hash=lambda row: row.content_sha256,
            build_document=_capture_document,
            upsert=lambda db, sha, vector: self._repo.upsert_capture_embedding(
                db,
                capture_id=capture_id,
                content_sha256=sha,
                embedding=vector,
                model=settings.embedding_model,
                created_at=utcnow(),
            ),
        )

    async def delete_capture(self, db: AsyncSession, capture_id: int) -> None:
        await self._repo.delete_capture_embedding(db, capture_id)

    # ----- Batch refresh -----

    async def refresh_stale(self, limit: int = 100, user_id: str | None = None) -> int:
        async with self._session_factory() as db:
            citation_candidates = await self._repo.find_stale_citation_candidates(
                db, model=settings.embedding_model, limit=limit, user_id=user_id
            )
            capture_candidates = await self._repo.find_stale_capture_candidates(
                db, model=settings.embedding_model, limit=limit, user_id=user_id
            )

        now = utcnow()
        model = settings.embedding_model

        citation_prepared = [
            PreparedEmbedding(c.id, c.content_sha256, doc)
            for c in citation_candidates
            if c.content_sha256 and (doc := _citation_document(c)).strip()
        ]
        capture_prepared = [
            PreparedEmbedding(c.id, c.content_sha256, doc)
            for c in capture_candidates
            if c.content_sha256 and (doc := _capture_document(c)).strip()
        ]

        citations, captures = await asyncio.gather(
            refresh_stale_embeddings(
                embedder=self._embedder,
                session_factory=self._session_factory,
                model=model,
                fk_column="citation_id",
                prepared=citation_prepared,
                now=now,
            ),
            refresh_stale_embeddings(
                embedder=self._embedder,
                session_factory=self._session_factory,
                model=model,
                fk_column="capture_id",
                prepared=capture_prepared,
                now=now,
            ),
        )
        return citations + captures

    async def count_stale(self, user_id: str | None = None) -> int:
        """Combined stale count across citations + captures."""
        async with self._session_factory() as db:
            citations = await self._repo.count_stale_citations(
                db, model=settings.embedding_model, user_id=user_id
            )
            captures = await self._repo.count_stale_captures(
                db, model=settings.embedding_model, user_id=user_id
            )
        return citations + captures
