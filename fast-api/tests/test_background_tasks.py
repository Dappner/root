from __future__ import annotations

import asyncio

import pytest

from app.core.background_tasks import spawn_async_task

pytestmark = pytest.mark.asyncio


async def test_spawn_async_task_returns_before_task_completes() -> None:
    started = asyncio.Event()
    release = asyncio.Event()
    completed = False

    async def slow_task() -> None:
        nonlocal completed
        started.set()
        await release.wait()
        completed = True

    spawn_async_task(slow_task, name="test-slow-task")

    await asyncio.wait_for(started.wait(), timeout=0.1)
    assert completed is False

    release.set()
    for _ in range(10):
        await asyncio.sleep(0)
        if completed:
            break

    assert completed is True
