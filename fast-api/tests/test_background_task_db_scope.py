"""Routes that schedule BackgroundTasks must commit their DB session first.

FastAPI runs BackgroundTasks *before* tearing down request-scoped dependencies,
so with the default ``Depends(get_db)`` the request's transaction commits only
after the background work has run. A task that re-reads what the request wrote
(e.g. embedding a new citation from its own session) then finds nothing and
silently skips. ``Depends(get_db, scope="function")`` commits when the handler
returns, before background tasks start.
"""

from collections.abc import Iterator

from fastapi.dependencies.models import Dependant
from fastapi.routing import APIRoute

from app.core.database import get_db
from app.main import app


def _walk(dependant: Dependant) -> Iterator[Dependant]:
    for sub in dependant.dependencies:
        yield sub
        yield from _walk(sub)


def test_background_task_routes_use_function_scoped_db() -> None:
    offenders = []
    checked = 0
    for route in app.routes:
        if not isinstance(route, APIRoute) or not route.dependant.background_tasks_param_name:
            continue
        for dep in _walk(route.dependant):
            if dep.call is get_db:
                checked += 1
                if dep.scope != "function":
                    offenders.append(f"{sorted(route.methods)} {route.path}")

    assert checked, "expected routes that take BackgroundTasks and get_db"
    assert not offenders, (
        'use Depends(get_db, scope="function") in routes that take BackgroundTasks: '
        + ", ".join(offenders)
    )
