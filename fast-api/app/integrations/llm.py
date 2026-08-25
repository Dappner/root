"""LLM client factory for Jetflow agents."""

from jetflow.clients.anthropic import AsyncAnthropicClient
from jetflow.clients.gemini import AsyncGeminiClient
from jetflow.clients.openai import AsyncOpenAIClient

from app.core.config import settings
from app.schemas.rag import ModelConfig


def create_llm_client(
    config: ModelConfig,
) -> AsyncGeminiClient | AsyncOpenAIClient | AsyncAnthropicClient:
    if config.provider == "openai":
        kwargs: dict = {"model": config.model, "api_key": settings.openai_api_key}
        if config.reasoning_effort:
            kwargs["reasoning_effort"] = config.reasoning_effort
        return AsyncOpenAIClient(**kwargs)

    if config.provider == "anthropic":
        kwargs = {"model": config.model, "api_key": settings.anthropic_api_key}
        if config.reasoning_effort:
            if config.model in {"claude-sonnet-5", "claude-opus-5"}:
                # Claude 5 uses adaptive thinking by default and steers it with
                # output_config.effort. Disable Jetflow's legacy token budget.
                kwargs["reasoning_effort"] = "none"
                kwargs["effort"] = config.reasoning_effort
            else:
                kwargs["reasoning_effort"] = config.reasoning_effort
        return AsyncAnthropicClient(**kwargs)

    kwargs = {"model": config.model, "api_key": settings.google_api_key}
    if config.thinking_level is not None:
        kwargs["thinking_level"] = config.thinking_level
    return AsyncGeminiClient(**kwargs)
