"""Run orchestration for the resumable /ask SSE stream.

Drives the RAG service event stream into the run store and tails buffered +
live events out to subscribers. Owns the background DB session so a run
survives client disconnects.
"""

import asyncio
import json
from collections.abc import AsyncGenerator, AsyncIterator
from typing import Any

from fastapi import Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import AsyncSessionLocal
from app.core.logging import get_logger
from app.core.streaming.ask_run_store import AskRun, ask_run_store
from app.core.streaming.sse import to_sse_event
from app.deps import get_voyage
from app.schemas.rag import AskRequest
from app.services.rag_service import RAGService

logger = get_logger(__name__)


async def stream_events(
    source: AsyncIterator[dict[str, Any]],
    db: AsyncSession,
    error_label: str,
) -> AsyncGenerator[dict[str, str], None]:
    """Consume a service event stream and yield SSE events (non-resumable path)."""
    try:
        async for event in source:
            sse = to_sse_event(event)
            if sse is not None:
                yield sse
    except Exception as e:
        logger.exception(f"Error during {error_label}: {e}")
        yield {"event": "error", "data": json.dumps({"message": str(e)})}
    finally:
        await db.close()


async def run_ask_in_background(run: AskRun, request: AskRequest) -> None:
    """Drive `ask_stream` to completion, writing each event into the run store.

    Owns its own DB session so the run survives client disconnects.
    """
    try:
        async with AsyncSessionLocal() as db:
            service = RAGService(db, get_voyage())
            async for event in service.ask_stream(user_id=run.user_id, request=request):
                tagged = ask_run_store.append_event(run, event)
                if tagged is None:
                    # Buffer overflow — stop producing; subscribers will see end-of-stream.
                    logger.warning(
                        "ask run %s overflowed buffer (%d events); aborting",
                        run.request_id,
                        len(run.events),
                    )
                    break
                for q in list(run.subscribers):
                    try:
                        q.put_nowait(tagged)
                    except asyncio.QueueFull:
                        # Slow subscriber — drop it; it can resume via GET.
                        run.remove_subscriber(q)
    except Exception as e:
        logger.exception("ask run %s failed: %s", run.request_id, e)
        err_event = {"type": "error", "message": str(e)}
        tagged = ask_run_store.append_event(run, err_event)
        if tagged is not None:
            for q in list(run.subscribers):
                try:
                    q.put_nowait(tagged)
                except asyncio.QueueFull:
                    run.remove_subscriber(q)
        ask_run_store.mark_done(run, error=str(e))
    else:
        ask_run_store.mark_done(run)


async def tail_run(
    run: AskRun,
    from_seq: int,
    http_request: Request,
    include_resume_ack: bool,
) -> AsyncGenerator[dict[str, str], None]:
    """Replay buffered events after `from_seq`, then tail live until done.

    `from_seq` is exclusive: events with seq > from_seq are emitted.
    `from_seq == -1` means "send everything from the start".
    """
    # Snapshot what's already buffered so we don't miss events between
    # replay and subscription. Subscribe BEFORE reading the buffer length so
    # any concurrently-appended events end up in the queue.
    queue = run.add_subscriber()
    try:
        replay_upto = len(run.events)
        replay = [e for e in run.events[:replay_upto] if e.get("seq", -1) > from_seq]

        if include_resume_ack:
            ack = to_sse_event(
                {
                    "type": "resume_ack",
                    "replayed": len(replay),
                    "from_seq": from_seq,
                    "seq": -1,  # not part of the buffered sequence
                }
            )
            if ack is not None:
                # Don't surface seq=-1 in the id field for the ack.
                ack.pop("id", None)
                yield ack

        for event in replay:
            sse = to_sse_event(event)
            if sse is not None:
                yield sse

        # Now drain the live queue, skipping anything we already replayed.
        while True:
            if await http_request.is_disconnected():
                return
            try:
                live_event: dict[str, Any] | None = await asyncio.wait_for(
                    queue.get(), timeout=15.0
                )
            except asyncio.TimeoutError:
                # Heartbeat — sse-starlette sends its own pings, just loop.
                continue
            if live_event is None:
                # Producer signalled end-of-stream.
                return
            if live_event.get("seq", -1) < replay_upto:
                # Already replayed above.
                continue
            sse = to_sse_event(live_event)
            if sse is not None:
                yield sse
    finally:
        run.remove_subscriber(queue)
