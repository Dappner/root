"""In-memory session store for reflection agent message history.

Keyed by (user_id, source_id). Sessions expire after TTL_SECONDS of inactivity.
A background sweep task evicts expired entries to bound memory usage.
Jetflow's ContextConfig handles per-session token limits.
"""

import asyncio
import time
from dataclasses import dataclass, field

from jetflow.models.message import Message

TTL_SECONDS = 2 * 60 * 60  # 2 hours
SWEEP_INTERVAL_SECONDS = 15 * 60  # sweep every 15 minutes


@dataclass
class _Session:
    messages: list[Message] = field(default_factory=list)
    last_used: float = field(default_factory=time.monotonic)


class ReflectSessionStore:
    def __init__(self) -> None:
        self._sessions: dict[str, _Session] = {}
        self._sweep_task: asyncio.Task | None = None

    def _key(self, user_id: str, source_id: int) -> str:
        return f"{user_id}:{source_id}"

    def get(self, user_id: str, source_id: int) -> list[Message]:
        session = self._sessions.get(self._key(user_id, source_id))
        if session is None:
            return []
        session.last_used = time.monotonic()
        return list(session.messages)

    def save(self, user_id: str, source_id: int, messages: list[Message]) -> None:
        self._sessions[self._key(user_id, source_id)] = _Session(
            messages=list(messages),
            last_used=time.monotonic(),
        )

    def clear(self, user_id: str, source_id: int) -> None:
        self._sessions.pop(self._key(user_id, source_id), None)

    def _sweep(self) -> None:
        cutoff = time.monotonic() - TTL_SECONDS
        expired = [k for k, s in self._sessions.items() if s.last_used < cutoff]
        for k in expired:
            del self._sessions[k]

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


reflect_session_store = ReflectSessionStore()
