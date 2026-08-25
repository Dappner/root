"""Helpers for small fire-and-forget async work."""

from __future__ import annotations

import asyncio
from collections.abc import Callable, Coroutine
from typing import Any

from app.core.logging import get_logger

logger = get_logger(__name__)

_running_tasks: set[asyncio.Task[Any]] = set()


def spawn_async_task(
    func: Callable[..., Coroutine[Any, Any, Any]],
    *args: Any,
    name: str | None = None,
    **kwargs: Any,
) -> None:
    """Start an async task and return immediately.

    This is useful from FastAPI ``BackgroundTasks`` when the response lifecycle
    should only dispatch work, not wait for slow external calls to finish.
    """
    task: asyncio.Task[Any] = asyncio.create_task(func(*args, **kwargs), name=name)
    _running_tasks.add(task)
    task.add_done_callback(_handle_task_done)


def _handle_task_done(task: asyncio.Task[Any]) -> None:
    _running_tasks.discard(task)
    try:
        task.result()
    except asyncio.CancelledError:
        logger.info("background task cancelled", extra={"task_name": task.get_name()})
    except Exception:
        logger.exception("background task failed", extra={"task_name": task.get_name()})
