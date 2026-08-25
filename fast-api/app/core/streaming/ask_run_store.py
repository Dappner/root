"""In-memory store for resumable /ask streaming runs.

Each entry holds the ordered list of events emitted by `ask_stream()` for a given
client-supplied `request_id`, plus a set of live subscriber queues that the
background producer fans events out to. HTTP handlers (the initial POST and the
resume GET) attach as subscribers, replay buffered events first, then drain the
queue until the producer signals end-of-stream.

TTL is short by design: once a run is `done`, it sticks around just long enough
to cover a transient mobile reconnect (~1 minute).
"""

from __future__ import annotations

import asyncio
import time
from dataclasses import dataclass, field
from typing import Any

DONE_TTL_SECONDS = 60  # how long to keep a finished run around for resume
SWEEP_INTERVAL_SECONDS = 30
MAX_EVENTS_PER_RUN = 10_000  # hard cap to bound memory on pathological runs
SUBSCRIBER_QUEUE_MAXSIZE = 1024


@dataclass
class AskRun:
    request_id: str
    user_id: str
    events: list[dict[str, Any]] = field(default_factory=list)
    done: bool = False
    overflow: bool = False  # set if MAX_EVENTS_PER_RUN was hit; resume disabled
    error: str | None = None
    finished_at: float | None = None  # monotonic time when `done` flipped True
    subscribers: set[asyncio.Queue[dict[str, Any] | None]] = field(default_factory=set)
    task: asyncio.Task[None] | None = None

    def add_subscriber(self) -> asyncio.Queue[dict[str, Any] | None]:
        q: asyncio.Queue[dict[str, Any] | None] = asyncio.Queue(maxsize=SUBSCRIBER_QUEUE_MAXSIZE)
        self.subscribers.add(q)
        return q

    def remove_subscriber(self, q: asyncio.Queue[dict[str, Any] | None]) -> None:
        self.subscribers.discard(q)


class AskRunStore:
    def __init__(self) -> None:
        self._runs: dict[str, AskRun] = {}
        self._sweep_task: asyncio.Task[None] | None = None

    def get(self, request_id: str) -> AskRun | None:
        return self._runs.get(request_id)

    def create(self, request_id: str, user_id: str) -> AskRun:
        run = AskRun(request_id=request_id, user_id=user_id)
        self._runs[request_id] = run
        return run

    def append_event(self, run: AskRun, event: dict[str, Any]) -> dict[str, Any] | None:
        """Append an event to the run, tagging it with its seq.

        Returns the tagged event (with `seq` set) so the caller can also fan
        it out to subscribers. Returns None and marks the run as overflow if
        the per-run cap is exceeded.
        """
        if run.overflow:
            return None
        if len(run.events) >= MAX_EVENTS_PER_RUN:
            run.overflow = True
            return None
        tagged = {**event, "seq": len(run.events)}
        run.events.append(tagged)
        return tagged

    def mark_done(self, run: AskRun, error: str | None = None) -> None:
        run.done = True
        run.error = error
        run.finished_at = time.monotonic()
        # Wake any subscribers still waiting.
        for q in list(run.subscribers):
            try:
                q.put_nowait(None)
            except asyncio.QueueFull:
                pass

    def _sweep(self) -> None:
        cutoff = time.monotonic() - DONE_TTL_SECONDS
        expired = [
            rid
            for rid, run in self._runs.items()
            if run.done and (run.finished_at is None or run.finished_at < cutoff)
        ]
        for rid in expired:
            del self._runs[rid]

    async def _sweep_loop(self) -> None:
        while True:
            await asyncio.sleep(SWEEP_INTERVAL_SECONDS)
            self._sweep()

    def start_sweep(self) -> None:
        if self._sweep_task is None or self._sweep_task.done():
            self._sweep_task = asyncio.create_task(self._sweep_loop())

    def stop_sweep(self) -> None:
        if self._sweep_task:
            self._sweep_task.cancel()
            self._sweep_task = None


ask_run_store = AskRunStore()
