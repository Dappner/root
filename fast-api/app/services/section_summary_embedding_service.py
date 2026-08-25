"""On-demand embedding generation for source-section summaries.

Mirrors the citation/takeaway services: a single-row generator for fresh
mutations and a batch refresh for stale rows. The embedded document is the
section title/subtitle/summary plus the source metadata block, matching what
the legacy Go pipeline produced so existing embeddings remain comparable.
"""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.core.config import settings
from app.core.datetime_utils import utcnow
from app.core.logging import get_logger
from app.integrations.voyage import VoyageClient
from app.repositories.section_embedding_repository import (
    SectionEmbeddingCandidate,
    SectionEmbeddingRepository,
)
from app.services._embedding_batch import PreparedEmbedding, refresh_stale_embeddings
from app.services._embedding_refresh import (
    generate_entity_embedding,
    render_embedding_document,
)

logger = get_logger(__name__)


def _build_document(candidate: SectionEmbeddingCandidate) -> str:
    # status + label intentionally excluded — see citation_embedding_service
    # for the rationale (mutable fields with no stale-detection signal).
    return render_embedding_document(
        [
            ("Content type", "source section summary"),
            ("Source title", candidate.source_title),
            ("Source type", candidate.source_type),
            ("Source author", candidate.source_author),
            ("Source published date", candidate.source_published_at),
            ("Podcast episode", candidate.podcast_episode_title),
            ("Podcast show", candidate.podcast_show_title),
            ("Podcast show author", candidate.podcast_show_author),
            ("Podcast duration seconds", candidate.podcast_duration),
            ("Podcast published date", candidate.podcast_published_at),
            ("Video title", candidate.video_title),
            ("Video platform", candidate.video_platform),
            ("Video channel", candidate.video_channel_name),
            ("Video duration seconds", candidate.video_duration),
            ("Video published date", candidate.video_published_at),
            ("Section title", candidate.title),
            ("Section subtitle", candidate.subtitle),
            ("Section summary", candidate.summary),
        ]
    )


class SectionSummaryEmbeddingService:
    def __init__(
        self,
        voyage: VoyageClient,
        session_factory: async_sessionmaker[AsyncSession],
        repository: SectionEmbeddingRepository | None = None,
    ):
        self._voyage = voyage
        self._session_factory = session_factory
        self._repo = repository or SectionEmbeddingRepository()

    async def generate(self, section_id: int, user_id: str) -> None:
        await generate_entity_embedding(
            session_factory=self._session_factory,
            voyage=self._voyage,
            logger=logger,
            log_label="section summary",
            log_extra={"section_id": section_id},
            get_candidate=lambda db: self._repo.get_candidate(
                db, section_id=section_id, user_id=user_id
            ),
            content_hash=lambda candidate: candidate.summary_sha256,
            build_document=_build_document,
            upsert=lambda db, sha, vector: self._repo.upsert_embedding(
                db,
                section_id=section_id,
                content_sha256=sha,
                embedding=vector,
                model=settings.embedding_model,
                created_at=utcnow(),
            ),
        )

    async def refresh_stale(self, limit: int = 100, user_id: str | None = None) -> int:
        async with self._session_factory() as db:
            candidates = await self._repo.find_stale_candidates(
                db, model=settings.embedding_model, limit=limit, user_id=user_id
            )

        prepared = [
            PreparedEmbedding(c.id, c.summary_sha256, _build_document(c))
            for c in candidates
            if c.summary_sha256
        ]

        return await refresh_stale_embeddings(
            voyage=self._voyage,
            session_factory=self._session_factory,
            model=settings.embedding_model,
            fk_column="section_id",
            prepared=prepared,
            now=utcnow(),
        )

    async def count_stale(self, user_id: str | None = None) -> int:
        async with self._session_factory() as db:
            return await self._repo.count_stale(db, model=settings.embedding_model, user_id=user_id)
