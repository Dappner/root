"""Jetflow actions for RAG agent."""

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.streaming.hit_store import HitStore
from app.integrations.voyage import VoyageClient
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
    voyage_client: VoyageClient,
) -> tuple[list, HitStore]:
    """Create all search actions with shared hit storage.

    Args:
        db: Database session
        user_id: User ID for scoping searches
        voyage_client: Voyage AI client for embeddings
    Returns:
        Tuple of (action instances list, hit_store)
    """
    hit_store = HitStore()
    embedder = EmbeddingService(voyage_client)

    actions = [
        Search(db, user_id, embedder, hit_store),
        ListSources(db, user_id, hit_store),
        SuggestCreateCitation(),
        SuggestCreateCapture(),
        SuggestCreateTakeaway(db, user_id),
        SuggestUpdateSectionSummary(),
    ]

    return actions, hit_store
