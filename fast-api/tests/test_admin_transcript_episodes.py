"""Integration tests for GET /rag-api/admin/transcript-episodes.

DB-backed (require ``TEST_DATABASE_URL``). The admin router gates on
``require_admin_user``; these tests override that dependency to authorize (or
to force a 403) rather than minting real JWTs. Each test builds its own
show/episode/source graph and cleans it up around the test.
"""

from __future__ import annotations

from collections.abc import AsyncGenerator

import pytest
import pytest_asyncio
from fastapi import HTTPException, status
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import require_admin_user
from app.core.database import get_db
from app.core.datetime_utils import utcnow
from app.main import app
from tests.conftest import TEST_USER_ID

pytestmark = pytest.mark.asyncio

_SHOW_SLUG = "test-transcript-episodes-show"


async def _wipe(db: AsyncSession) -> None:
    # Sources FK episode_id ON DELETE SET NULL; delete our test sources first,
    # then episodes, then the show (CASCADE would also clear episodes).
    await db.execute(
        text("DELETE FROM sources WHERE user_id = :u AND title LIKE 'TE-%'").bindparams(
            u=TEST_USER_ID
        )
    )
    await db.execute(
        text(
            "DELETE FROM podcast_episodes WHERE show_id IN "
            "(SELECT id FROM shows WHERE slug = :s)"
        ).bindparams(s=_SHOW_SLUG)
    )
    await db.execute(text("DELETE FROM shows WHERE slug = :s").bindparams(s=_SHOW_SLUG))
    await db.commit()


@pytest_asyncio.fixture(autouse=True)
async def _clean(db: AsyncSession) -> AsyncGenerator[None, None]:
    await _wipe(db)
    yield
    await _wipe(db)


async def _make_episode(db: AsyncSession, show_id: int, title: str, status_: str) -> int:
    row = (
        await db.execute(
            text(
                """
                INSERT INTO podcast_episodes
                    (show_id, episode_guid, title, transcript_status, created_at, updated_at)
                VALUES (:show_id, :guid, :title, CAST(:status AS transcript_status), :now, :now)
                RETURNING id
                """
            ).bindparams(
                show_id=show_id,
                guid=f"guid-{title}",
                title=title,
                status=status_,
                now=utcnow(),
            )
        )
    ).one()
    return int(row.id)


async def _make_source(db: AsyncSession, title: str, type_: str, episode_id: int | None) -> int:
    row = (
        await db.execute(
            text(
                """
                INSERT INTO sources (user_id, title, type, episode_id, created_at, updated_at)
                VALUES (:u, :title, :type, :episode_id, :now, :now)
                RETURNING id
                """
            ).bindparams(
                u=TEST_USER_ID,
                title=title,
                type=type_,
                episode_id=episode_id,
                now=utcnow(),
            )
        )
    ).one()
    return int(row.id)


@pytest_asyncio.fixture
async def admin_client(db: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    """ASGI client with get_db bound to the test session and admin authorized."""

    async def _get_db_override() -> AsyncGenerator[AsyncSession, None]:
        yield db

    app.dependency_overrides[get_db] = _get_db_override
    app.dependency_overrides[require_admin_user] = lambda: TEST_USER_ID

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.pop(get_db, None)
    app.dependency_overrides.pop(require_admin_user, None)


async def _make_show(db: AsyncSession) -> int:
    row = (
        await db.execute(
            text(
                """
                INSERT INTO shows (slug, rss_feed_url, title, created_at, updated_at)
                VALUES (:slug, 'https://example.com/rss', 'TE Show', :now, :now)
                RETURNING id
                """
            ).bindparams(slug=_SHOW_SLUG, now=utcnow())
        )
    ).one()
    return int(row.id)


async def test_returns_transcribed_episodes_deduped(
    admin_client: AsyncClient, db: AsyncSession
) -> None:
    show_id = await _make_show(db)
    transcribed = await _make_episode(db, show_id, "TE-transcribed", "transcribed")
    pending = await _make_episode(db, show_id, "TE-pending", "pending")

    # Two podcast sources point at the same transcribed episode -> one result row.
    src_a = await _make_source(db, "TE-podcast-a", "podcast", transcribed)
    await _make_source(db, "TE-podcast-b", "podcast", transcribed)
    # Podcast source on a non-transcribed episode -> excluded.
    await _make_source(db, "TE-podcast-pending", "podcast", pending)
    # Non-podcast source on the transcribed episode -> excluded by type filter.
    await _make_source(db, "TE-article", "article", transcribed)
    await db.commit()

    res = await admin_client.get("/rag-api/admin/transcript-episodes")
    assert res.status_code == 200, res.text
    body = res.json()

    assert len(body) == 1
    item = body[0]
    assert item["episodeId"] == transcribed
    assert item["episodeTitle"] == "TE-transcribed"
    assert item["transcriptStatus"] == "transcribed"
    # DISTINCT ON (episode_id) ORDER BY episode_id, source_id -> lowest source id wins.
    assert item["sourceId"] == src_a
    assert item["sourceTitle"] == "TE-podcast-a"


async def test_empty_when_no_transcribed_episodes(
    admin_client: AsyncClient, db: AsyncSession
) -> None:
    show_id = await _make_show(db)
    pending = await _make_episode(db, show_id, "TE-pending", "pending")
    await _make_source(db, "TE-podcast-pending", "podcast", pending)
    await db.commit()

    res = await admin_client.get("/rag-api/admin/transcript-episodes")
    assert res.status_code == 200, res.text
    assert res.json() == []


async def test_non_admin_forbidden(db: AsyncSession) -> None:
    async def _get_db_override() -> AsyncGenerator[AsyncSession, None]:
        yield db

    def _forbid() -> str:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin role required")

    app.dependency_overrides[get_db] = _get_db_override
    app.dependency_overrides[require_admin_user] = _forbid
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            res = await ac.get("/rag-api/admin/transcript-episodes")
        assert res.status_code == 403, res.text
    finally:
        app.dependency_overrides.pop(get_db, None)
        app.dependency_overrides.pop(require_admin_user, None)
