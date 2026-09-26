"""Live LLM provider: vendor-backed Jetflow clients (OpenAI, Anthropic, Gemini)."""

from jetflow.clients.anthropic import AsyncAnthropicClient
from jetflow.clients.base import AsyncBaseClient
from jetflow.clients.gemini import AsyncGeminiClient
from jetflow.clients.openai import AsyncOpenAIClient

from app.core.config import Settings
from app.schemas.rag import ModelConfig


class JetflowLLMProvider:
    """LLMProvider that builds the vendor's Jetflow client for a ModelConfig."""

    def __init__(self, settings: Settings) -> None:
        self._keys = {
            "openai": settings.openai_api_key,
            "anthropic": settings.anthropic_api_key,
            "gemini": settings.google_api_key,
        }

    def client(self, config: ModelConfig) -> AsyncBaseClient:
        api_key = self._keys.get(config.provider, self._keys["gemini"])
        if not api_key:
            raise ValueError(f"No API key configured for LLM provider {config.provider!r}")

        if config.provider == "openai":
            kwargs: dict = {"model": config.model, "api_key": api_key}
            if config.reasoning_effort:
                kwargs["reasoning_effort"] = config.reasoning_effort
            return AsyncOpenAIClient(**kwargs)

        if config.provider == "anthropic":
            kwargs = {"model": config.model, "api_key": api_key}
            if config.reasoning_effort:
                if config.model in {"claude-sonnet-5", "claude-opus-5"}:
                    # Claude 5 uses adaptive thinking by default and steers it with
                    # output_config.effort. Disable Jetflow's legacy token budget.
                    kwargs["reasoning_effort"] = "none"
                    kwargs["effort"] = config.reasoning_effort
                else:
                    kwargs["reasoning_effort"] = config.reasoning_effort
            return AsyncAnthropicClient(**kwargs)

        kwargs = {"model": config.model, "api_key": api_key}
        if config.thinking_level is not None:
            kwargs["thinking_level"] = config.thinking_level
        return AsyncGeminiClient(**kwargs)
