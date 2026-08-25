"""RAG service using Jetflow agent for retrieval and generation."""

import time
from collections.abc import AsyncIterator
from typing import Any

import logfire
from jetflow import (
    ActionExecuted,
    ActionExecutionStart,
    ContentDelta,
    MessageEnd,
    ThoughtDelta,
    ThoughtEnd,
    ThoughtStart,
)
from jetflow.agent.utils import calculate_usage
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.logging import get_logger
from app.core.streaming.reflect_session_store import reflect_session_store
from app.integrations.voyage import VoyageClient
from app.schemas.rag import (
    AskRequest,
    ReflectRequest,
    RetrievalHit,
)
from app.services.agent import create_rag_agent
from app.services.agent.followup_agent import generate_followups
from app.services.agent.reflection_agent import create_reflection_agent
from app.services.agent.tool_display import build_tool_display
from app.services.assistant_context import AssistantContextResolver

logger = get_logger(__name__)


def _serialize_citations(citations: dict) -> dict[str, Any]:
    return {
        str(k): v.model_dump(mode="json") if hasattr(v, "model_dump") else v
        for k, v in citations.items()
    }


def _format_followup_context(citations: dict) -> str:
    parts: list[str] = []
    for idx, citation in citations.items():
        data = citation.model_dump(mode="json") if hasattr(citation, "model_dump") else citation
        if not isinstance(data, dict):
            continue
        kind = data.get("type") or "context"
        title = data.get("takeaway_title") or data.get("section_title") or data.get("source_title")
        text = data.get("takeaway_body") or data.get("section_summary") or data.get("text")
        if not text:
            continue
        label = f"<{idx}> [{kind}]"
        if title:
            label += f" {title}"
        parts.append(f"{label}: {text}")
    return "\n\n".join(parts)


def _format_chat_history(history: list[Any]) -> str:
    if not history:
        return ""

    parts: list[str] = []
    for message in history:
        role = getattr(message, "role", "")
        content = getattr(message, "content", "").strip()
        if role and content:
            parts.append(f"{role.title()}: {content}")
    return "\n\n".join(parts)


class RAGService:
    """Service for RAG operations using Jetflow agent."""

    def __init__(self, db: AsyncSession, voyage_client: VoyageClient):
        self.db = db
        self.voyage_client = voyage_client

    async def ask_stream(
        self,
        user_id: str,
        request: AskRequest,
    ) -> AsyncIterator[dict[str, Any]]:
        """Ask a question and stream the response with citations."""
        model_config = request.model_config_
        provider = model_config.provider if model_config else "gemini"
        model = model_config.model if model_config else "gemini-3.6-flash"
        question = request.question
        action_timers: dict[str, float] = {}
        resolved_context = await AssistantContextResolver(self.db).resolve(
            user_id=user_id,
            context=request.context,
        )
        prompt_parts: list[str] = []
        if resolved_context:
            prompt_parts.append(resolved_context.text)
        if history_text := _format_chat_history(request.history):
            prompt_parts.append(f"Previous conversation:\n{history_text}")
        prompt_parts.append(f"User message:\n{question}")
        agent_question = "\n\n".join(prompt_parts)

        logger.info(f"Starting RAG stream for user {user_id}, question: '{question[:100]}...'")
        if request.history:
            logger.info(
                "Continuing ask conversation for user %s with %d FE-provided history messages",
                user_id,
                len(request.history),
            )
            logfire.info(
                "rag.ask.session.continue",
                user_id=user_id,
                message_count=len(request.history),
            )
        else:
            logger.info("Starting new ask conversation for user %s", user_id)
            logfire.info("rag.ask.session.start", user_id=user_id)

        yield {"type": "started"}

        with logfire.span(
            "rag.ask_stream",
            user_id=user_id,
            provider=provider,
            model=model,
            question_len=len(question),
        ):
            try:
                agent_ctx = create_rag_agent(
                    db=self.db,
                    user_id=user_id,
                    voyage_client=self.voyage_client,
                    model_config=request.model_config_,
                )
            except Exception as e:
                logger.error(f"Failed to create RAG agent for user {user_id}: {e}", exc_info=True)
                raise

            yield {"type": "planning"}

            all_citations: dict = {}
            seen_citation_ids: set[str] = set()
            answer_parts: list[str] = []
            action_names: dict[str, str] = {}
            action_args: dict[str, dict] = {}
            thought_timers: dict[str, float] = {}

            try:
                async for event in agent_ctx.agent.stream(agent_question):
                    if isinstance(event, ThoughtStart):
                        thought_timers[event.id] = time.monotonic()

                    elif isinstance(event, ThoughtDelta):
                        yield {
                            "type": "reasoning",
                            "thought_id": event.id,
                            "text": event.delta,
                        }

                    elif isinstance(event, ThoughtEnd):
                        started = thought_timers.pop(event.id, None)
                        yield {
                            "type": "reasoning_done",
                            "thought_id": event.id,
                            "duration_ms": (
                                (time.monotonic() - started) * 1000.0
                                if started is not None
                                else None
                            ),
                        }

                    elif isinstance(event, ActionExecutionStart):
                        action_names[event.id] = event.name
                        action_args[event.id] = event.body
                        action_timers[event.id] = time.monotonic()
                        logfire.info("rag.tool.start", tool=event.name, args=event.body)
                        yield {
                            "type": "tool_call",
                            "call_id": event.id,
                            "name": event.name,
                            "args": event.body,
                            "display": build_tool_display(event.name, event.body),
                        }

                    elif isinstance(event, ActionExecuted):
                        action_name = action_names.get(event.action_id, "unknown")
                        args = action_args.get(event.action_id, {})
                        start_time = action_timers.pop(event.action_id, None)
                        duration_ms = (
                            (time.monotonic() - start_time) * 1000.0
                            if start_time is not None
                            else None
                        )
                        logfire.info(
                            "rag.tool.end",
                            tool=action_name,
                            summary=event.summary,
                            duration_ms=duration_ms,
                            is_exit=event.is_exit,
                        )
                        metadata = (
                            event.action.result.get("metadata")
                            if event.action and event.action.result
                            else {}
                        )
                        summary = event.summary or f"Completed {action_name}"
                        yield {
                            "type": "tool_result",
                            "call_id": event.action_id,
                            "name": action_name,
                            "args": args,
                            "summary": summary,
                            "metadata": metadata,
                            "display": build_tool_display(
                                action_name,
                                args,
                                summary=summary,
                                metadata=metadata,
                            ),
                        }
                        if isinstance(metadata, dict) and metadata.get("suggestion"):
                            yield {"type": "suggestion", "suggestion": metadata["suggestion"]}

                        if (
                            event.message
                            and hasattr(event.message, "citations")
                            and event.message.citations
                        ):
                            all_citations.update(event.message.citations)

                    elif isinstance(event, ContentDelta):
                        answer_parts.append(event.delta)
                        delta_data: dict[str, Any] = {"type": "delta", "text": event.delta}

                        if event.citations:
                            new_citations = {}
                            for cid_str, meta in event.citations.items():
                                if str(cid_str) not in seen_citation_ids:
                                    seen_citation_ids.add(str(cid_str))
                                    new_citations[str(cid_str)] = meta
                                    try:
                                        all_citations[int(cid_str)] = meta
                                    except (ValueError, TypeError):
                                        all_citations[cid_str] = meta
                            if new_citations:
                                delta_data["citations"] = _serialize_citations(new_citations)

                        yield delta_data

                    elif isinstance(event, MessageEnd):
                        if hasattr(event.message, "citations") and event.message.citations:
                            all_citations.update(event.message.citations)

                        msg = event.message
                        uncached = msg.uncached_prompt_tokens or 0
                        cache_write = msg.cache_write_tokens or 0
                        cache_read = msg.cache_read_tokens or 0
                        thinking = msg.thinking_tokens or 0
                        completion = msg.completion_tokens or 0
                        if any(
                            v is not None
                            for v in [
                                msg.uncached_prompt_tokens,
                                msg.cache_write_tokens,
                                msg.cache_read_tokens,
                                msg.thinking_tokens,
                                msg.completion_tokens,
                            ]
                        ):
                            prompt = uncached + cache_write + cache_read
                            msg_usage = calculate_usage(
                                [msg],
                                agent_ctx.agent.client.provider,
                                agent_ctx.agent.client.model,
                            )
                            logfire.info(
                                "rag.llm.message_usage",
                                provider=agent_ctx.agent.client.provider,
                                model=agent_ctx.agent.client.model,
                                uncached_prompt_tokens=uncached,
                                cache_write_tokens=cache_write,
                                cache_read_tokens=cache_read,
                                thinking_tokens=thinking,
                                completion_tokens=completion,
                                prompt_tokens=prompt,
                                total_tokens=prompt + thinking + completion,
                                estimated_cost=msg_usage.estimated_cost,
                            )

                usage_total = calculate_usage(
                    agent_ctx.agent.messages,
                    agent_ctx.agent.client.provider,
                    agent_ctx.agent.client.model,
                )
                logfire.info(
                    "rag.llm.total_usage",
                    provider=agent_ctx.agent.client.provider,
                    model=agent_ctx.agent.client.model,
                    prompt_tokens=usage_total.prompt_tokens,
                    uncached_prompt_tokens=usage_total.uncached_prompt_tokens,
                    cache_write_tokens=usage_total.cache_write_tokens,
                    cache_read_tokens=usage_total.cache_read_tokens,
                    thinking_tokens=usage_total.thinking_tokens,
                    completion_tokens=usage_total.completion_tokens,
                    total_tokens=usage_total.total_tokens,
                    estimated_cost=usage_total.estimated_cost,
                )

                final_answer = "".join(answer_parts)
                if not final_answer.strip():
                    logger.warning("Agent produced no final answer text")

                yield {"type": "answer_done", "citations": _serialize_citations(all_citations)}

            except Exception as e:
                logger.exception(f"Error in RAG agent for user {user_id}: {e}")
                yield {"type": "error", "message": str(e)}

    async def reflect_stream(
        self,
        user_id: str,
        source_id: int,
        request: ReflectRequest,
    ) -> AsyncIterator[dict[str, Any]]:
        """Stream a reflection session scoped to a single source."""
        model_config = request.model_config_
        provider = model_config.provider if model_config else "gemini"
        model = model_config.model if model_config else "gemini-3.6-flash"
        question = request.question
        action_timers: dict[str, float] = {}

        logger.info(
            f"Starting reflection stream for user {user_id}, source {source_id}, "
            f"question: '{question[:100]}...'"
        )

        yield {"type": "started"}

        with logfire.span(
            "rag.reflect_stream",
            user_id=user_id,
            source_id=source_id,
            provider=provider,
            model=model,
            question_len=len(question),
        ):
            try:
                agent_ctx = create_reflection_agent(
                    db=self.db,
                    user_id=user_id,
                    source_id=source_id,
                    voyage_client=self.voyage_client,
                    model_config=request.model_config_,
                )
            except Exception as e:
                logger.error(
                    "Failed to create reflection agent for "
                    f"user {user_id}, source {source_id}: {e}",
                    exc_info=True,
                )
                raise

            history = reflect_session_store.get(user_id, source_id)
            if history:
                logger.info(
                    "Continuing reflect session for user %s, source %s with %d stored messages",
                    user_id,
                    source_id,
                    len(history),
                )
                logfire.info(
                    "rag.reflect.session.continue",
                    user_id=user_id,
                    source_id=source_id,
                    message_count=len(history),
                )
                agent_ctx.agent.messages = history
            else:
                logger.info(
                    "Starting new reflect session for user %s, source %s",
                    user_id,
                    source_id,
                )
                logfire.info(
                    "rag.reflect.session.start",
                    user_id=user_id,
                    source_id=source_id,
                )

            yield {"type": "planning"}

            all_citations: dict = {}
            seen_citation_ids: set[str] = set()
            answer_parts: list[str] = []
            action_names: dict[str, str] = {}
            action_args: dict[str, dict] = {}
            thought_timers: dict[str, float] = {}

            try:
                async for event in agent_ctx.agent.stream(question):
                    if isinstance(event, ThoughtStart):
                        thought_timers[event.id] = time.monotonic()

                    elif isinstance(event, ThoughtDelta):
                        yield {
                            "type": "reasoning",
                            "thought_id": event.id,
                            "text": event.delta,
                        }

                    elif isinstance(event, ThoughtEnd):
                        started = thought_timers.pop(event.id, None)
                        yield {
                            "type": "reasoning_done",
                            "thought_id": event.id,
                            "duration_ms": (
                                (time.monotonic() - started) * 1000.0
                                if started is not None
                                else None
                            ),
                        }

                    elif isinstance(event, ActionExecutionStart):
                        action_names[event.id] = event.name
                        action_args[event.id] = event.body
                        action_timers[event.id] = time.monotonic()
                        logfire.info("rag.reflect.tool.start", tool=event.name, args=event.body)
                        yield {
                            "type": "tool_call",
                            "call_id": event.id,
                            "name": event.name,
                            "args": event.body,
                            "display": build_tool_display(event.name, event.body),
                        }

                    elif isinstance(event, ActionExecuted):
                        action_name = action_names.get(event.action_id, "unknown")
                        args = action_args.get(event.action_id, {})
                        start_time = action_timers.pop(event.action_id, None)
                        duration_ms = (
                            (time.monotonic() - start_time) * 1000.0
                            if start_time is not None
                            else None
                        )
                        logfire.info(
                            "rag.reflect.tool.end",
                            tool=action_name,
                            summary=event.summary,
                            duration_ms=duration_ms,
                        )
                        metadata = (
                            event.action.result.get("metadata")
                            if event.action and event.action.result
                            else {}
                        )
                        summary = event.summary or f"Completed {action_name}"
                        yield {
                            "type": "tool_result",
                            "call_id": event.action_id,
                            "name": action_name,
                            "args": args,
                            "summary": summary,
                            "metadata": metadata,
                            "display": build_tool_display(
                                action_name,
                                args,
                                summary=summary,
                                metadata=metadata,
                            ),
                        }
                        if isinstance(metadata, dict) and metadata.get("suggestion"):
                            yield {"type": "suggestion", "suggestion": metadata["suggestion"]}

                        if (
                            event.message
                            and hasattr(event.message, "citations")
                            and event.message.citations
                        ):
                            all_citations.update(event.message.citations)

                        if event.action and event.action.result:
                            suggestions = (event.action.result.get("metadata") or {}).get(
                                "suggestions"
                            )
                            if suggestions:
                                yield {"type": "suggestions", "suggestions": suggestions}

                    elif isinstance(event, ContentDelta):
                        answer_parts.append(event.delta)
                        delta_data: dict[str, Any] = {"type": "delta", "text": event.delta}

                        if event.citations:
                            new_citations = {}
                            for cid_str, meta in event.citations.items():
                                if str(cid_str) not in seen_citation_ids:
                                    seen_citation_ids.add(str(cid_str))
                                    new_citations[str(cid_str)] = meta
                                    try:
                                        all_citations[int(cid_str)] = meta
                                    except (ValueError, TypeError):
                                        all_citations[cid_str] = meta
                            if new_citations:
                                delta_data["citations"] = _serialize_citations(new_citations)

                        yield delta_data

                    elif isinstance(event, MessageEnd):
                        if hasattr(event.message, "citations") and event.message.citations:
                            all_citations.update(event.message.citations)

                        msg = event.message
                        uncached = msg.uncached_prompt_tokens or 0
                        cache_write = msg.cache_write_tokens or 0
                        cache_read = msg.cache_read_tokens or 0
                        thinking = msg.thinking_tokens or 0
                        completion = msg.completion_tokens or 0
                        if any(
                            v is not None
                            for v in [
                                msg.uncached_prompt_tokens,
                                msg.cache_write_tokens,
                                msg.cache_read_tokens,
                                msg.thinking_tokens,
                                msg.completion_tokens,
                            ]
                        ):
                            prompt = uncached + cache_write + cache_read
                            logfire.info(
                                "rag.reflect.llm.message_usage",
                                provider=agent_ctx.agent.client.provider,
                                model=agent_ctx.agent.client.model,
                                uncached_prompt_tokens=uncached,
                                cache_write_tokens=cache_write,
                                cache_read_tokens=cache_read,
                                thinking_tokens=thinking,
                                completion_tokens=completion,
                                prompt_tokens=prompt,
                                total_tokens=prompt + thinking + completion,
                            )

                usage_total = calculate_usage(
                    agent_ctx.agent.messages,
                    agent_ctx.agent.client.provider,
                    agent_ctx.agent.client.model,
                )
                logfire.info(
                    "rag.reflect.llm.total_usage",
                    provider=agent_ctx.agent.client.provider,
                    model=agent_ctx.agent.client.model,
                    prompt_tokens=usage_total.prompt_tokens,
                    completion_tokens=usage_total.completion_tokens,
                    total_tokens=usage_total.total_tokens,
                    estimated_cost=usage_total.estimated_cost,
                )

                final_answer = "".join(answer_parts)
                yield {"type": "answer_done", "citations": _serialize_citations(all_citations)}

                followups = await self._generate_followups(
                    question=question,
                    answer=final_answer,
                    context=_format_followup_context(all_citations),
                )
                if followups:
                    yield {"type": "followups", "followups": followups}

            except Exception as e:
                logger.exception(
                    f"Error in reflection agent for user {user_id}, source {source_id}: {e}"
                )
                yield {"type": "error", "message": str(e)}
            finally:
                if agent_ctx.agent.messages:
                    reflect_session_store.save(user_id, source_id, agent_ctx.agent.messages)
                    logger.info(
                        f"Saved reflect session for user {user_id}, source {source_id} "
                        f"({len(agent_ctx.agent.messages)} messages)"
                    )

    async def _generate_followups(
        self,
        *,
        question: str,
        answer: str,
        context: str,
    ) -> list[str]:
        """Generate post-answer follow-up prompts without failing the main response."""
        if not answer.strip() or not settings.google_api_key:
            return []

        try:
            return await generate_followups(
                user_question=question,
                answer=answer,
                context=context,
            )
        except Exception as e:
            logger.warning("Follow-up prompt generation failed: %s", e, exc_info=True)
            return []

    async def retrieve(
        self,
        user_id: str,
        request: AskRequest,
    ) -> list[RetrievalHit]:
        """Retrieve relevant context using the agent (non-streaming fallback)."""
        agent_ctx = create_rag_agent(
            db=self.db,
            user_id=user_id,
            voyage_client=self.voyage_client,
            model_config=request.model_config_,
        )
        await agent_ctx.agent.run(request.question)
        return agent_ctx.get_all_hits()
