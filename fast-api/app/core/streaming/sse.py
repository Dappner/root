"""Serialization of RAG service events into SSE frames.

Pure transport layer: maps the service's event dicts to SSE
``{event, data, id}`` frames. No FastAPI or route knowledge.
"""

import json
from typing import Any

# Event types that carry no data payload — the event name is the message.
_BARE_EVENTS = {"started", "planning", "reranking", "answering"}


def to_sse_event(event: dict[str, Any]) -> dict[str, str] | None:
    """Convert a service event dict to an SSE {event, data, id} dict.

    Every event includes a `seq` (when tagged by the run store), which is
    forwarded as both the SSE `id:` field (for standard `Last-Event-ID`
    auto-reconnect semantics) and inside the `data` JSON payload (so clients
    that read `data` only can also use it).

    Returns None for unknown event types (they are silently dropped).
    """
    event_type = event.get("type")
    seq = event.get("seq")

    def _frame(name: str, payload: dict[str, Any] | None = None) -> dict[str, str]:
        body: dict[str, Any] = {} if payload is None else dict(payload)
        if seq is not None:
            body["seq"] = seq
        frame: dict[str, str] = {"event": name, "data": json.dumps(body)}
        if seq is not None:
            frame["id"] = str(seq)
        return frame

    if event_type in _BARE_EVENTS:
        return _frame(event_type)

    if event_type == "delta":
        delta_payload: dict[str, Any] = {"text": event.get("text", "")}
        if citations := event.get("citations"):
            delta_payload["citations"] = citations
        return _frame("delta", delta_payload)

    if event_type == "reasoning":
        return _frame(
            "reasoning",
            {"thought_id": event.get("thought_id"), "text": event.get("text", "")},
        )

    if event_type == "reasoning_done":
        return _frame(
            "reasoning_done",
            {
                "thought_id": event.get("thought_id"),
                "duration_ms": event.get("duration_ms"),
            },
        )

    if event_type == "tool_call":
        return _frame(
            "tool_call",
            {
                "call_id": event.get("call_id"),
                "name": event.get("name"),
                "args": event.get("args", {}),
                "display": event.get("display"),
            },
        )

    if event_type == "tool_result":
        return _frame(
            "tool_result",
            {
                "call_id": event.get("call_id"),
                "name": event.get("name"),
                "args": event.get("args", {}),
                "summary": event.get("summary", ""),
                "metadata": event.get("metadata", {}),
                "display": event.get("display"),
            },
        )

    if event_type == "answer_done":
        return _frame("answer_done", {"citations": event.get("citations", {})})

    if event_type == "suggestions":
        return _frame("suggestions", {"suggestions": event.get("suggestions", [])})
    if event_type == "suggestion":
        return _frame("suggestion", {"suggestion": event.get("suggestion")})
    if event_type == "followups":
        return _frame("followups", {"followups": event.get("followups", [])})

    if event_type == "error":
        return _frame("error", {"message": event.get("message", "Unknown error")})

    if event_type == "resume_ack":
        return _frame(
            "resume_ack",
            {
                "replayed": event.get("replayed", 0),
                "from_seq": event.get("from_seq", -1),
            },
        )

    return None
