"""Tests for the follow-up chip agent's consumption of the jetflow response.

After the exit action jetflow ends the run on the tool message: `.parsed` is
unset and `.content` is the action's JSON return value (see test_fake_llm.py,
which drives the real agent). Follow-up chips are non-critical, so a
missing/prose response degrades to no chips (never raises).
"""

from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services.agent.followup_agent import FollowUpPrompts, generate_followups


def _patch_agent(response: SimpleNamespace):
    agent_instance = MagicMock()
    agent_instance.run = AsyncMock(return_value=response)
    return patch(
        "app.services.agent.followup_agent.AsyncAgent",
        return_value=agent_instance,
    )


def _no_llm():
    return patch("app.services.agent.followup_agent.create_llm_client", MagicMock())


@pytest.mark.asyncio
async def test_returns_prompts_from_exit_action_content():
    body = FollowUpPrompts(prompts=["What about trade?", "  Why education?  "])
    response = SimpleNamespace(parsed=None, content=body.model_dump_json())
    with _no_llm(), _patch_agent(response):
        result = await generate_followups(user_question="q", answer="a", context="c")
    # Whitespace stripped, order preserved.
    assert result == ["What about trade?", "Why education?"]


@pytest.mark.asyncio
async def test_prose_response_degrades_to_empty_list():
    """Model replied in prose without calling the tool -> no chips, no crash."""
    response = SimpleNamespace(parsed=None, content="Here are some ideas...")
    with _no_llm(), _patch_agent(response):
        result = await generate_followups(user_question="q", answer="a", context="c")
    assert result == []
