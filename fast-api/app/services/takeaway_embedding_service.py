"""On-demand embedding generation for source takeaways.

The embedding's content_sha256 mirrors the takeaway row's content_sha256, so
stale detection is a simple equality compare between the two columns.
"""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.core.config import settings
from app.core.datetime_utils import utcnow
from app.core.logging import get_logger
from app.providers.embedder import Embedder
from app.repositories.takeaway_embedding_repository import (
    TakeawayEmbeddingCandidate,
    TakeawayEmbeddingRepository,
)
from app.services._embedding_batch import PreparedEmbedding, refresh_stale_embeddings
from app.services._embedding_refresh import generate_entity_embedding

logger = get_logger(__name__)


def _build_document(row: TakeawayEmbeddingCandidate) -> str:
    """Keep the document focused on title/body. Source title only as
    disambiguation context — too much surrounding text hurts recall on a
    single takeaway."""
    parts: list[str] = []
    if row.title:
        parts.append(row.title.strip())
    if row.body:
        parts.append(row.body.strip())
    if row.source_title:
        parts.append(f"Source: {row.source_title.strip()}")
    return "\n\n".join(p for p in parts if p)


class TakeawayEmbeddingService:
    """Generates and upserts embeddings for source takeaways.

    Routes invoke `generate` via FastAPI BackgroundTasks after create/update;
    the admin endpoint calls `refresh_stale` to backfill.
    """

    def __init__(
        self,
        embedder: Embedder,
        session_factory: async_sessionmaker[AsyncSession],
        repository: TakeawayEmbeddingRepository | None = None,
    ):
        self._embedder = embedder
        self._session_factory = session_factory
        self._repo = repository or TakeawayEmbeddingRepository()

    async def generate(self, takeaway_id: int, user_id: str) -> None:
        await generate_entity_embedding(
            session_factory=self._session_factory,
            embedder=self._embedder,
            logger=logger,
            log_label="takeaway",
            log_extra={"takeaway_id": takeaway_id},
            get_candidate=lambda db: self._repo.get_candidate(
                db, takeaway_id=takeaway_id, user_id=user_id
            ),
            content_hash=lambda candidate: candidate.content_sha256,
            build_document=_build_document,
            upsert=lambda db, sha, vector: self._repo.upsert_embedding(
                db,
                takeaway_id=takeaway_id,
                content_sha256=sha,
                embedding=vector,
                model=settings.embedding_model,
                created_at=utcnow(),
            ),
        )

    async def delete(self, db: AsyncSession, takeaway_id: int) -> None:
        await self._repo.delete_embedding(db, takeaway_id)

    async def refresh_stale(self, limit: int = 100, user_id: str | None = None) -> int:
        async with self._session_factory() as db:
            candidates = await self._repo.find_stale_candidates(
                db, model=settings.embedding_model, limit=limit, user_id=user_id
            )

        prepared = [
            PreparedEmbedding(c.id, c.content_sha256, _build_document(c))
            for c in candidates
            if c.content_sha256
        ]

        return await refresh_stale_embeddings(
            embedder=self._embedder,
            session_factory=self._session_factory,
            model=settings.embedding_model,
            fk_column="takeaway_id",
            prepared=prepared,
            now=utcnow(),
        )

    async def count_stale(self, user_id: str | None = None) -> int:
        async with self._session_factory() as db:
            return await self._repo.count_stale(db, model=settings.embedding_model, user_id=user_id)
