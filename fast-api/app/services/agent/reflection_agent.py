"""Jetflow agent factory for source-scoped reflection."""

from dataclasses import dataclass
from pathlib import Path

from jetflow import AsyncAgent
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.core.streaming.hit_store import HitStore
from app.providers.embedder import Embedder
from app.providers.llm import create_llm_client
from app.schemas.rag import ModelConfig, RetrievalHit
from app.services.agent.actions.get_source_context import GetSourceContext
from app.services.agent.actions.search import Search
from app.services.agent.actions.suggest_uncaptured_citations import SuggestUncapturedCitations
from app.services.agent.actions.suggestions import SuggestCreateTakeaway
from app.services.embedding import EmbeddingService

logger = get_logger(__name__)

_PROMPT_FILE = Path(__file__).parent.parent.parent / "prompts" / "reflection_agent.md"
REFLECTION_SYSTEM_PROMPT = _PROMPT_FILE.read_text().strip()

DEFAULT_MODEL_CONFIG = ModelConfig(provider="gemini", model="gemini-3.6-flash")
DEFAULT_MAX_ITER = 10


@dataclass
class ReflectionAgentContext:
    """Context for reflection agent with access to hits storage."""

    agent: AsyncAgent
    hit_store: HitStore

    def get_all_hits(self) -> list[RetrievalHit]:
        return self.hit_store.all_hits()


def create_reflection_agent(
    db: AsyncSession,
    user_id: str,
    source_id: int,
    embedder: Embedder,
    model_config: ModelConfig | None = None,
) -> ReflectionAgentContext:
    config = model_config or DEFAULT_MODEL_CONFIG

    hit_store = HitStore()
    search_embeddings = EmbeddingService(embedder)

    search_action = Search(db, user_id, search_embeddings, hit_store)
    context_action = GetSourceContext(db, user_id, hit_store)
    suggest_action = SuggestUncapturedCitations(db, user_id)
    suggest_takeaway_action = SuggestCreateTakeaway(db, user_id)

    system_prompt = (
        f"The user is reflecting on source ID {source_id}. "
        f"Every call to `search` MUST include `source_ids: [{source_id}]`. "
        f"Every call to `get_source_context` MUST use source_id={source_id}. "
        f"Every call to `suggest_uncaptured_citations` MUST use source_id={source_id}.\n\n"
        f"Every call to `suggest_create_takeaway` MUST use source_id={source_id}.\n\n"
        + REFLECTION_SYSTEM_PROMPT
    )

    client = create_llm_client(config)

    agent = AsyncAgent(
        client=client,
        actions=[context_action, search_action, suggest_action, suggest_takeaway_action],  # type: ignore[list-item]
        system_prompt=system_prompt,
        require_action=False,
        # TODO: Revisit the right iteration budget once we have better runaway-loop safeguards.
        max_iter=DEFAULT_MAX_ITER,
        verbose=False,
    )

    return ReflectionAgentContext(agent=agent, hit_store=hit_store)
