"""Tests for model config validation."""

import pytest
from pydantic import ValidationError

from app.integrations.llm import create_llm_client
from app.schemas.rag import ModelConfig
from app.services.voice_suggestion_matcher import DEFAULT_MODEL, REASONING_EFFORT


def test_gemini_3_1_pro_allows_medium_thinking_level():
    config = ModelConfig(
        provider="gemini",
        model="gemini-3.1-pro-preview",
        thinking_level="medium",
    )

    assert config.thinking_level == "medium"


def test_openai_rejects_gemini_thinking_level_field():
    with pytest.raises(ValidationError):
        ModelConfig(
            provider="openai",
            model="gpt-5.6-terra",
            thinking_level="high",
        )


def test_model_config_rejects_retired_model():
    with pytest.raises(ValidationError, match="not available"):
        ModelConfig(provider="openai", model="gpt-5.4-mini")


def test_claude_sonnet_5_allows_max_effort():
    config = ModelConfig(
        provider="anthropic",
        model="claude-sonnet-5",
        reasoning_effort="max",
    )

    assert config.reasoning_effort == "max"


def test_claude_5_maps_reasoning_to_adaptive_effort():
    client = create_llm_client(
        ModelConfig(
            provider="anthropic",
            model="claude-sonnet-5",
            reasoning_effort="xhigh",
        )
    )

    assert client.reasoning_budget == 0
    assert client.effort == "xhigh"


def test_voice_suggestion_matcher_default_model_config_is_valid():
    config = ModelConfig(
        provider="openai",
        model=DEFAULT_MODEL,
        reasoning_effort=REASONING_EFFORT,
    )

    assert config.model == DEFAULT_MODEL
