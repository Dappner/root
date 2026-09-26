"""Shared fixtures for DB-backed integration tests.

Tests opt in by depending on the ``db`` fixture. We point at a Postgres instance
via ``TEST_DATABASE_URL``, assume migrations are applied (run ``make test-db-up``
in ``go-api`` once), and clean the touched tables between tests.

Tests with no ``db`` fixture (e.g. unit-only) skip the DB setup entirely so
``pytest`` still works on a developer machine without the test database.
"""

from __future__ import annotations

import os

# Tests never call real providers; set before app.clients builds the embedder.
os.environ.setdefault("EMBEDDING_PROVIDER", "fake")

from collections.abc import AsyncGenerator  # noqa: E402

import pytest  # noqa: E402
import pytest_asyncio  # noqa: E402
from fastapi import Request  # noqa: E402
from httpx import ASGITransport, AsyncClient  # noqa: E402
from sqlalchemy import text  # noqa: E402
from sqlalchemy.ext.asyncio import (  # noqa: E402
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.core.auth import get_current_user_id  # noqa: E402
from app.core.cache import reset_cache_for_tests  # noqa: E402
from app.core.database import get_db  # noqa: E402
from app.main import app  # noqa: E402

TEST_USER_ID = "test-user-tags"
OTHER_USER_ID = "other-user-tags"

# Fixtures that pull in the Postgres test database. Any test depending on one
# of these (directly or transitively) is auto-marked `integration` so CI can
# run unit-only (`-m "not integration"`) and DB-backed suites as separate jobs.
_DB_FIXTURES = frozenset({"db", "client", "other_user_client"})


def pytest_collection_modifyitems(items: list[pytest.Item]) -> None:
    for item in items:
        if _DB_FIXTURES.intersection(getattr(item, "fixturenames", ())):
            item.add_marker("integration")


def _resolve_test_db_url() -> str:
    raw = os.environ.get("TEST_DATABASE_URL")
    if raw is None:
        pytest.skip("TEST_DATABASE_URL not set; run `make test-db-up` in go-api and export the URL")
        raise RuntimeError("unreachable")  # narrows `raw` to str for mypy
    if raw.startswith("postgres://"):
        raw = raw.replace("postgres://", "postgresql+asyncpg://", 1)
    elif raw.startswith("postgresql://") and "+asyncpg" not in raw:
        raw = raw.replace("postgresql://", "postgresql+asyncpg://", 1)
    # Strip libpq-only params that asyncpg rejects.
    for param in ("sslmode=disable", "sslmode=require", "sslmode=prefer"):
        raw = raw.replace(f"?{param}", "").replace(f"&{param}", "")
    return raw


@pytest_asyncio.fixture
async def db() -> AsyncGenerator[AsyncSession, None]:
    """Yield a session bound to the test DB and clean tag rows around the test."""
    reset_cache_for_tests()
    engine = create_async_engine(_resolve_test_db_url(), pool_pre_ping=True)
    sessionmaker = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with engine.begin() as conn:
        await conn.execute(
            text(
                "DELETE FROM source_tags WHERE tag_id IN "
                "(SELECT id FROM tags WHERE user_id = ANY(:u))"
            ).bindparams(u=[TEST_USER_ID, OTHER_USER_ID])
        )
        await conn.execute(
            text("DELETE FROM tags WHERE user_id = ANY(:u)").bindparams(
                u=[TEST_USER_ID, OTHER_USER_ID]
            )
        )
        # Tags FK to auth.user — ensure both test users exist (idempotent).
        for uid in (TEST_USER_ID, OTHER_USER_ID):
            await conn.execute(
                text("""
                    INSERT INTO auth."user" (id, name, email, email_verified)
                    VALUES (:id, :name, :email, true)
                    ON CONFLICT (id) DO NOTHING
                    """).bindparams(id=uid, name=uid, email=f"{uid}@test.local")
            )

    async with sessionmaker() as session:
        try:
            yield session
        finally:
            await session.close()

    async with engine.begin() as conn:
        await conn.execute(
            text(
                "DELETE FROM source_tags WHERE tag_id IN "
                "(SELECT id FROM tags WHERE user_id = ANY(:u))"
            ).bindparams(u=[TEST_USER_ID, OTHER_USER_ID])
        )
        await conn.execute(
            text("DELETE FROM tags WHERE user_id = ANY(:u)").bindparams(
                u=[TEST_USER_ID, OTHER_USER_ID]
            )
        )

    await engine.dispose()
    reset_cache_for_tests()


_USER_HEADER = "X-Test-User-Id"


@pytest_asyncio.fixture
async def client(db: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    """Authed ASGI client. Defaults to TEST_USER_ID; pass ``X-Test-User-Id``
    on a request to authenticate as someone else (used by cross-user tests)."""

    async def _get_db_override() -> AsyncGenerator[AsyncSession, None]:
        yield db

    async def _get_user_override(request: Request) -> str:
        return request.headers.get(_USER_HEADER, TEST_USER_ID)

    app.dependency_overrides[get_db] = _get_db_override
    app.dependency_overrides[get_current_user_id] = _get_user_override

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.pop(get_db, None)
    app.dependency_overrides.pop(get_current_user_id, None)


@pytest_asyncio.fixture
async def other_user_client(client: AsyncClient) -> AsyncGenerator[AsyncClient, None]:
    """Second client sharing ``client``'s app/dep overrides but auth'd as OTHER_USER_ID.

    Reusing the same transport keeps the dep overrides registered by ``client``
    (so requests still hit the per-test session). We just stamp a header that
    the override reads to pick a different user.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(
        transport=transport,
        base_url="http://test",
        headers={_USER_HEADER: OTHER_USER_ID},
    ) as ac:
        yield ac
