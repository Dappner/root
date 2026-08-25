"""List user sources action for Jetflow agent."""

from jetflow import ActionResult, action
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.core.streaming.hit_store import HitStore
from app.repositories.source_repository import SourceRepository

logger = get_logger(__name__)


class ListSourcesSchema(BaseModel):
    """List the user's saved sources.

    Use this to find source IDs when the user mentions a specific
    book, article, or document by name. Returns a list of sources
    with their IDs, titles, and types.
    """

    limit: int = Field(default=20, description="Maximum number of sources to return")


@action(schema=ListSourcesSchema)
class ListSources:
    """List user's saved sources."""

    def __init__(
        self,
        db: AsyncSession,
        user_id: str,
        hit_store: HitStore,
    ):
        """Initialize with dependencies.

        Args:
            db: Database session (shared across all actions)
            user_id: User ID for scoping queries
            hit_store: Shared storage (not used by this action, but kept for consistency)
        """
        self.db = db
        self.user_id = user_id
        self.hit_store = hit_store
        self._sources = SourceRepository()

    async def __call__(self, params: ListSourcesSchema, citation_start: int = 1) -> ActionResult:
        """List user's saved sources.

        Args:
            params: Query parameters (limit)
            citation_start: Starting citation ID (unused, no citations returned)

        Returns:
            ActionResult with list of sources (no citations)
        """
        logger.info(f"[list_user_sources] limit={params.limit}")

        try:
            sources = await self._sources.list_for_user(self.db, self.user_id, limit=params.limit)

            lines = [f"ID: {src.id} | Title: {src.title} | Type: {src.type}" for src in sources]
            content = "No sources found." if not lines else "\n".join(lines)

            logger.info(f"[list_user_sources] Success: {len(lines)} sources")

            return ActionResult(
                content=content,
                citations={},
                summary=f"Listed {len(lines)} source(s)",
            )
        except Exception as e:
            logger.error(f"[list_user_sources] Failed: {e}", exc_info=True)
            raise
