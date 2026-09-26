"""LLM seam: FakeLLMClient driven through real Jetflow agents, and provider selection."""

import pytest
from jetflow import AsyncAgent, action
from jetflow.models.events import ContentDelta, MessageEnd
from pydantic import BaseModel

from app.core.config import Settings
from app.integrations.llm import JetflowLLMProvider
from app.providers.llm import (
    FakeLLMClient,
    FakeLLMError,
    FakeLLMProvider,
    create_llm_provider,
    set_llm_provider,
)
from app.schemas.rag import ModelConfig
from app.services.agent.followup_agent import generate_followups
from app.services.voice_suggestion_matcher import VoiceSuggestionMatcher

_DB = {"database_url": "postgresql://t:t@localhost/t"}


class Lookup(BaseModel):
    """Look something up."""

    query: str


lookups: list[str] = []


@action(schema=Lookup)
def lookup(params: Lookup) -> str:
    lookups.append(params.query)
    return f"found notes about {params.query}"


def _fake(**kw) -> FakeLLMClient:
    return FakeLLMClient(
        model="m",
        responders={"Lookup": lambda req: {"query": req.prompt}},
        auto_call=frozenset({"Lookup"}),
        **kw,
    )


@pytest.mark.asyncio
async def test_agent_calls_auto_tool_once_then_answers() -> None:
    lookups.clear()
    agent = AsyncAgent(client=_fake(), actions=[lookup], max_iter=4, verbose=False)

    response = await agent.run("compounding curiosity")

    assert lookups == ["compounding curiosity"]
    assert response.content.startswith("[fake-llm]")
    assert "Tool results: 1" in response.content


@pytest.mark.asyncio
async def test_agent_stream_yields_text_deltas_and_end() -> None:
    lookups.clear()
    agent = AsyncAgent(client=_fake(), actions=[lookup], max_iter=4, verbose=False)

    events = [e async for e in agent.stream("streamed question")]

    text = "".join(e.delta for e in events if isinstance(e, ContentDelta))
    assert "[fake-llm]" in text
    assert any(isinstance(e, MessageEnd) for e in events)
    assert lookups == ["streamed question"]


@pytest.mark.asyncio
async def test_default_responders_cover_exit_actions_and_extract() -> None:
    set_llm_provider(FakeLLMProvider())
    try:
        prompts = await generate_followups(user_question="q", answer="a", context="c")
        match = await VoiceSuggestionMatcher().match(
            voice_transcript="this bit",
            playback_position_seconds=12.0,
            candidate_utterances=[{"index": 0, "start": 10.0, "end": 14.0, "text": "hello"}],
        )
    finally:
        set_llm_provider(None)

    assert len(prompts) == 2 and all(p.startswith("[fake-llm]") for p in prompts)
    assert match.action == "uncertain"


@pytest.mark.asyncio
async def test_required_action_without_responder_fails_loudly() -> None:
    client = FakeLLMClient(model="m", responders={})

    with pytest.raises(FakeLLMError, match="Lookup"):
        await client.complete(messages=[], system_prompt="", actions=[lookup], require_action=True)


def test_provider_selection_and_live_key_check() -> None:
    assert isinstance(create_llm_provider(Settings(**_DB, llm_provider="fake")), FakeLLMProvider)
    live = create_llm_provider(Settings(**_DB, llm_provider="live", google_api_key=""))
    assert isinstance(live, JetflowLLMProvider)
    with pytest.raises(ValueError, match="gemini"):
        live.client(ModelConfig(provider="gemini", model="gemini-3.6-flash"))
    with pytest.raises(ValueError):
        create_llm_provider(Settings(**_DB, llm_provider="nope"))
