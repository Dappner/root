"""LLM provider seam.

Services get Jetflow clients through ``create_llm_client(config)``; which
provider backs them is decided once from settings (``LLM_PROVIDER=live|fake``).
Jetflow's ``AsyncBaseClient`` is the vendor-neutral client interface, so the
seam only has to choose how clients are built.
"""

from __future__ import annotations

import uuid
from collections.abc import AsyncIterator, Callable
from dataclasses import dataclass, field
from typing import Any, Protocol

from jetflow.clients.base import AsyncBaseClient
from jetflow.models.events import (
    ActionEnd,
    ActionStart,
    ContentDelta,
    MessageEnd,
    MessageStart,
    StreamEvent,
)
from jetflow.models.message import ActionBlock, Message, TextBlock
from pydantic import BaseModel

from app.core.config import Settings
from app.schemas.rag import ModelConfig


class LLMProvider(Protocol):
    def client(self, config: ModelConfig) -> AsyncBaseClient: ...


_provider: LLMProvider | None = None


def create_llm_provider(settings: Settings) -> LLMProvider:
    if settings.llm_provider == "fake":
        return FakeLLMProvider()
    if settings.llm_provider == "live":
        from app.integrations.llm import JetflowLLMProvider

        return JetflowLLMProvider(settings)
    raise ValueError(f"unknown LLM_PROVIDER: {settings.llm_provider!r}")


def get_llm_provider() -> LLMProvider:
    global _provider
    if _provider is None:
        from app.core.config import settings

        _provider = create_llm_provider(settings)
    return _provider


def set_llm_provider(provider: LLMProvider | None) -> None:
    """Swap the process-wide provider (tests); None re-reads settings on next use."""
    global _provider
    _provider = provider


def create_llm_client(config: ModelConfig) -> AsyncBaseClient:
    """The Jetflow client for ``config`` from the configured provider."""
    return get_llm_provider().client(config)


# --- Fake ---------------------------------------------------------------------


@dataclass
class FakeLLMRequest:
    """What a scripted responder sees."""

    prompt: str  # last user text (or the extract query)
    system_prompt: str
    tool_results: list[str] = field(default_factory=list)


Responder = Callable[[FakeLLMRequest], dict[str, Any]]


def _followups(req: FakeLLMRequest) -> dict[str, Any]:
    return {"prompts": ["[fake-llm] Tell me more", "[fake-llm] How does this connect?"]}


def _sections(req: FakeLLMRequest) -> dict[str, Any]:
    return {"sections": [{"start_sec": 0, "end_sec": 60, "title": "[fake-llm] Section 1"}]}


def _voice_match(req: FakeLLMRequest) -> dict[str, Any]:
    return {
        "action": "uncertain",
        "confidence": 0.0,
        "reasoning_summary": "[fake-llm] no real model; always uncertain",
    }


def _search(req: FakeLLMRequest) -> dict[str, Any]:
    return {"query": req.prompt}


# Keyed by the Pydantic schema class name of a Jetflow action or extract() target.
DEFAULT_RESPONDERS: dict[str, Responder] = {
    "FollowUpPrompts": _followups,
    "AutoSectionList": _sections,
    "VoiceSuggestionMatch": _voice_match,
    "SearchSchema": _search,
}
# Non-exit actions the fake calls once per conversation before answering, so
# agent runs exercise real tool code (e.g. RAG search → embeddings → SQL).
DEFAULT_AUTO_CALL = frozenset({"SearchSchema"})


class FakeLLMError(RuntimeError):
    pass


class FakeLLMClient(AsyncBaseClient):
    """Deterministic, offline Jetflow client.

    - Required action (``require_action`` / ``allowed_actions`` / ``tool_choice="required"``):
      calls the first offered action that has a responder.
    - Otherwise: calls each auto-call action once, then answers in text
      starting with ``[fake-llm]``.
    - ``extract(schema)``: the schema's responder, validated.
    No responder for what is asked → ``FakeLLMError`` naming the schema.
    """

    provider = "fake"

    def __init__(
        self,
        model: str,
        responders: dict[str, Responder] | None = None,
        auto_call: frozenset[str] = DEFAULT_AUTO_CALL,
    ) -> None:
        self.model = model
        self.responders = DEFAULT_RESPONDERS if responders is None else responders
        self.auto_call = auto_call

    def _request(self, messages: list[Message], system_prompt: str) -> FakeLLMRequest:
        prompt, tool_results = "", []
        for m in messages:
            text = "".join(b.text for b in m.blocks if isinstance(b, TextBlock))
            if m.role == "user" and text:
                prompt = text
            elif m.role == "tool":
                tool_results.append(text or (m._tool_content or ""))
        return FakeLLMRequest(prompt=prompt, system_prompt=system_prompt, tool_results=tool_results)

    def _respond(self, schema: type[BaseModel], req: FakeLLMRequest) -> dict[str, Any]:
        responder = self.responders.get(schema.__name__)
        if responder is None:
            raise FakeLLMError(f"FakeLLMClient has no responder for {schema.__name__}")
        return schema.model_validate(responder(req)).model_dump(mode="json")

    def _plan(
        self,
        messages: list[Message],
        system_prompt: str,
        actions: list[Any],
        allowed_actions: list[Any] | None,
        tool_choice: str,
        require_action: bool,
    ) -> Message:
        req = self._request(messages, system_prompt)
        called = {b.name for m in messages for b in m.blocks if isinstance(b, ActionBlock)}
        offered = allowed_actions or actions or []

        chosen = None
        if require_action or allowed_actions or tool_choice == "required":
            chosen = next((a for a in offered if a.schema.__name__ in self.responders), None)
            if chosen is None:
                names = [a.schema.__name__ for a in offered]
                raise FakeLLMError(f"FakeLLMClient has no responder for required actions {names}")
        elif tool_choice != "none":
            chosen = next(
                (
                    a
                    for a in offered
                    if a.schema.__name__ in self.auto_call and a.name not in called
                ),
                None,
            )

        if chosen is not None:
            body = self._respond(chosen.schema, req)
            block = ActionBlock(id=str(uuid.uuid4()), name=chosen.name, body=body)
            return Message(role="assistant", blocks=[block])

        found = f" Tool results: {len(req.tool_results)}." if req.tool_results else ""
        text = (
            f"[fake-llm] Stubbed answer from {self.model} (no real model).{found} "
            f"You asked: {' '.join(req.prompt.split())[:160]}"
        )
        return Message(role="assistant", blocks=[TextBlock(text=text)], completion_tokens=0)

    async def complete(  # type: ignore[override]
        self,
        messages: list[Message],
        system_prompt: str,
        actions: list[Any],
        allowed_actions: list[Any] | None = None,
        tool_choice: str = "auto",
        logger: Any = None,
        enable_caching: bool = False,
        context_cache_index: int | None = None,
        require_action: bool = False,
        **_: Any,
    ) -> Message:
        return self._plan(
            messages, system_prompt, actions, allowed_actions, tool_choice, require_action
        )

    async def stream(  # type: ignore[override]
        self,
        messages: list[Message],
        system_prompt: str,
        actions: list[Any],
        allowed_actions: list[Any] | None = None,
        tool_choice: str = "auto",
        logger: Any = None,
        enable_caching: bool = False,
        context_cache_index: int | None = None,
        require_action: bool = False,
        **_: Any,
    ) -> AsyncIterator[StreamEvent]:
        message = self._plan(
            messages, system_prompt, actions, allowed_actions, tool_choice, require_action
        )
        yield MessageStart(role="assistant")
        for block in message.blocks:
            if isinstance(block, ActionBlock):
                yield ActionStart(id=block.id, name=block.name)
                yield ActionEnd(id=block.id, name=block.name, body=block.body)
            elif isinstance(block, TextBlock):
                words = block.text.split(" ")
                for i in range(0, len(words), 4):
                    yield ContentDelta(delta=" ".join(words[i : i + 4]) + " ")
        yield MessageEnd(message=message)

    async def extract(
        self,
        schema: type[BaseModel],
        query: str,
        system_prompt: str = "Extract the requested information.",
    ) -> BaseModel:
        return schema.model_validate(
            self._respond(schema, FakeLLMRequest(prompt=query, system_prompt=system_prompt))
        )


class FakeLLMProvider:
    """LLMProvider handing out FakeLLMClients (optionally with custom responders)."""

    def __init__(self, responders: dict[str, Responder] | None = None) -> None:
        self.responders = responders

    def client(self, config: ModelConfig) -> AsyncBaseClient:
        return FakeLLMClient(model=config.model, responders=self.responders)
