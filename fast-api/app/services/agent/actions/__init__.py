"""Jetflow actions for RAG agent."""

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.streaming.hit_store import HitStore
from app.providers.embedder import Embedder
from app.services.embedding import EmbeddingService

from .list_sources import ListSources
from .search import Search
from .suggestions import (
    SuggestCreateCapture,
    SuggestCreateCitation,
    SuggestCreateTakeaway,
    SuggestUpdateSectionSummary,
)

__all__ = [
    "Search",
    "ListSources",
    "SuggestCreateCapture",
    "SuggestCreateCitation",
    "SuggestCreateTakeaway",
    "SuggestUpdateSectionSummary",
    "create_search_actions",
]


def create_search_actions(
    db: AsyncSession,
    user_id: str,
    embedder: Embedder,
) -> tuple[list, HitStore]:
    """Create all search actions with shared hit storage.

    Args:
        db: Database session
        user_id: User ID for scoping searches
        embedder: embedding provider (query embeddings + rerank)
    Returns:
        Tuple of (action instances list, hit_store)
    """
    hit_store = HitStore()
    search_embeddings = EmbeddingService(embedder)

    actions = [
        Search(db, user_id, search_embeddings, hit_store),
        ListSources(db, user_id, hit_store),
        SuggestCreateCitation(),
        SuggestCreateCapture(),
        SuggestCreateTakeaway(db, user_id),
        SuggestUpdateSectionSummary(),
    ]

    return actions, hit_store
