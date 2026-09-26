"""Jetflow agent factory for RAG."""

from dataclasses import dataclass
from pathlib import Path

from jetflow import AsyncAgent
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.core.streaming.hit_store import HitStore
from app.providers.embedder import Embedder
from app.providers.llm import create_llm_client
from app.schemas.rag import ModelConfig, RetrievalHit
from app.services.agent.actions import create_search_actions

logger = get_logger(__name__)

# Load system prompt from markdown file
_PROMPT_FILE = Path(__file__).parent.parent.parent / "prompts" / "rag_agent.md"
AGENT_SYSTEM_PROMPT = _PROMPT_FILE.read_text().strip()


@dataclass
class RAGAgentContext:
    """Context for RAG agent with access to hits storage."""

    agent: AsyncAgent
    hit_store: HitStore

    def get_all_hits(self) -> list[RetrievalHit]:
        """Collect all retrieved hits from all search actions."""
        return self.hit_store.all_hits()


DEFAULT_MODEL_CONFIG = ModelConfig(provider="gemini", model="gemini-3.6-flash")
# TODO: Revisit the right iteration budget once we have better runaway-loop safeguards.
DEFAULT_MAX_ITER = 10


def create_rag_agent(
    db: AsyncSession,
    user_id: str,
    embedder: Embedder,
    max_iter: int = DEFAULT_MAX_ITER,
    model_config: ModelConfig | None = None,
) -> RAGAgentContext:
    config = model_config or DEFAULT_MODEL_CONFIG
    logger.debug(
        f"Creating RAG agent for user {user_id}, max_iter={max_iter}, model={config.model}"
    )

    # Create actions with shared hits storage
    actions, hit_store = create_search_actions(
        db,
        user_id,
        embedder,
    )
    logger.debug(f"Created {len(actions)} search actions")

    # Create LLM client based on provider
    client = create_llm_client(config)

    # Create the async agent
    agent = AsyncAgent(
        client=client,
        actions=actions,
        system_prompt=AGENT_SYSTEM_PROMPT,
        require_action=False,
        max_iter=max_iter,
        verbose=False,
    )

    logger.debug(f"RAG agent created successfully for user {user_id}")

    return RAGAgentContext(
        agent=agent,
        hit_store=hit_store,
    )
