"""Integration tests for multiple captures per citation end-to-end.

DB-backed (require ``TEST_DATABASE_URL``); the ``client`` fixture authenticates
as ``TEST_USER_ID``. Covers the pluralized citations API: creating a citation
with N captures, and that every read path (create response, detail GET, list,
source list, patch) returns all of them.
"""

from __future__ import annotations

from collections.abc import AsyncGenerator

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.citations import citation_embedding_service
from app.main import app
from tests.conftest import OTHER_USER_ID, TEST_USER_ID

pytestmark = pytest.mark.asyncio


class _NoopEmbedding:
    """Stub for CitationEmbeddingService so create background tasks don't open
    the production AsyncSessionLocal engine during tests (which otherwise leaks
    a connection across function-scoped event loops in teardown)."""

    async def generate_citation(self, citation_id: int, user_id: str) -> None:
        return None

    async def generate_capture(self, capture_id: int, user_id: str) -> None:
        return None


@pytest_asyncio.fixture(autouse=True)
async def _stub_embeddings() -> AsyncGenerator[None, None]:
    app.dependency_overrides[citation_embedding_service] = lambda: _NoopEmbedding()
    yield
    app.dependency_overrides.pop(citation_embedding_service, None)


async def _wipe(db: AsyncSession) -> None:
    # The get_db override yields this session to request handlers without
    # committing, so it may carry pending ORM state from the test's requests.
    # Drop it before issuing DELETEs so the wipe's commit doesn't re-flush
    # instances bound to an already-closed event loop.
    await db.rollback()
    users = [TEST_USER_ID, OTHER_USER_ID]
    await db.execute(
        text(
            "DELETE FROM rag_embeddings WHERE source_id IN "
            "(SELECT id FROM sources WHERE user_id = ANY(:u))"
        ).bindparams(u=users)
    )
    await db.execute(text("DELETE FROM captures WHERE user_id = ANY(:u)").bindparams(u=users))
    await db.execute(text("DELETE FROM citations WHERE user_id = ANY(:u)").bindparams(u=users))
    await db.execute(text("DELETE FROM sources WHERE user_id = ANY(:u)").bindparams(u=users))
    await db.commit()


@pytest_asyncio.fixture(autouse=True)
async def _clean(db: AsyncSession) -> AsyncGenerator[None, None]:
    await _wipe(db)
    yield
    await _wipe(db)


async def _create_source(client: AsyncClient) -> int:
    res = await client.post("/rag-api/sources", json={"title": "Captures Source", "type": "book"})
    assert res.status_code == 201, res.text
    sid: int = res.json()["id"]
    return sid


def _capture_texts(captures: list[dict]) -> set[str]:
    return {c["text"] for c in captures}


async def test_create_citation_with_multiple_captures_roundtrips(client: AsyncClient) -> None:
    source_id = await _create_source(client)
    res = await client.post(
        "/rag-api/citations",
        json={
            "text": "a citation with two captures",
            "source_id": source_id,
            "captures": [
                {"text": "first capture"},
                {"text": "second capture"},
            ],
        },
    )
    assert res.status_code == 201, res.text
    body = res.json()

    # Create response: top-level captures list AND nested on the citation.
    assert _capture_texts(body["captures"]) == {"first capture", "second capture"}
    assert _capture_texts(body["citation"]["captures"]) == {
        "first capture",
        "second capture",
    }
    citation_id = body["citation"]["id"]
    # Every capture is linked back to the citation.
    for cap in body["citation"]["captures"]:
        assert cap["citation_id"] == citation_id

    # Detail GET returns all captures.
    res = await client.get(f"/rag-api/citations/{citation_id}")
    assert res.status_code == 200, res.text
    assert _capture_texts(res.json()["captures"]) == {"first capture", "second capture"}

    # List endpoints return all captures.
    res = await client.get("/rag-api/citations")
    assert res.status_code == 200, res.text
    row = next(c for c in res.json() if c["id"] == citation_id)
    assert _capture_texts(row["captures"]) == {"first capture", "second capture"}

    res = await client.get(f"/rag-api/sources/{source_id}/citations")
    assert res.status_code == 200, res.text
    row = next(c for c in res.json() if c["id"] == citation_id)
    assert _capture_texts(row["captures"]) == {"first capture", "second capture"}

    # PATCH response also carries the captures.
    res = await client.patch(f"/rag-api/citations/{citation_id}", json={"text": "edited"})
    assert res.status_code == 200, res.text
    assert _capture_texts(res.json()["captures"]) == {"first capture", "second capture"}


async def test_create_citation_without_captures_returns_empty_list(client: AsyncClient) -> None:
    source_id = await _create_source(client)
    res = await client.post(
        "/rag-api/citations",
        json={"text": "no captures here", "source_id": source_id},
    )
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["captures"] == []
    assert body["citation"]["captures"] == []


async def _create_citation_with_captures(
    client: AsyncClient, source_id: int, texts: list[str]
) -> dict:
    res = await client.post(
        "/rag-api/citations",
        json={
            "text": "delta base citation",
            "source_id": source_id,
            "captures": [{"text": t} for t in texts],
        },
    )
    assert res.status_code == 201, res.text
    return res.json()["citation"]


async def test_patch_captures_delta_applies_create_update_delete_atomically(
    client: AsyncClient,
) -> None:
    source_id = await _create_source(client)
    citation = await _create_citation_with_captures(client, source_id, ["keep me", "remove me"])
    citation_id = citation["id"]
    by_text = {c["text"]: c["id"] for c in citation["captures"]}
    keep_id = by_text["keep me"]
    remove_id = by_text["remove me"]

    res = await client.patch(
        f"/rag-api/citations/{citation_id}",
        json={
            "captures": {
                "create": [{"text": "brand new"}],
                "update": [{"id": keep_id, "text": "kept and edited"}],
                "delete": [remove_id],
            }
        },
    )
    assert res.status_code == 200, res.text
    assert _capture_texts(res.json()["captures"]) == {"kept and edited", "brand new"}

    # Re-read confirms persistence (single transaction committed).
    res = await client.get(f"/rag-api/citations/{citation_id}")
    assert res.status_code == 200, res.text
    assert _capture_texts(res.json()["captures"]) == {"kept and edited", "brand new"}


async def test_patch_without_captures_field_leaves_captures_untouched(
    client: AsyncClient,
) -> None:
    source_id = await _create_source(client)
    citation = await _create_citation_with_captures(client, source_id, ["untouched"])
    citation_id = citation["id"]

    res = await client.patch(
        f"/rag-api/citations/{citation_id}", json={"text": "new citation text"}
    )
    assert res.status_code == 200, res.text
    assert res.json()["text"] == "new citation text"
    assert _capture_texts(res.json()["captures"]) == {"untouched"}


async def test_patch_captures_delta_text_only_update_preserves_summary(
    client: AsyncClient,
) -> None:
    source_id = await _create_source(client)
    # Create a citation whose capture carries a summary.
    res = await client.post(
        "/rag-api/citations",
        json={
            "text": "summary base",
            "source_id": source_id,
            "captures": [{"text": "original thought", "summary": "the gist"}],
        },
    )
    assert res.status_code == 201, res.text
    citation = res.json()["citation"]
    capture_id = citation["captures"][0]["id"]

    # A text-only delta (no summary field) must not wipe the summary.
    res = await client.patch(
        f"/rag-api/citations/{citation['id']}",
        json={"captures": {"update": [{"id": capture_id, "text": "edited thought"}]}},
    )
    assert res.status_code == 200, res.text

    # Verify against the capture's own endpoint, since CaptureResponse on the
    # citation doesn't expose summary.
    res = await client.get(f"/rag-api/sources/{source_id}/captures")
    assert res.status_code == 200, res.text
    row = next(c for c in res.json() if c["id"] == capture_id)
    assert row["text"] == "edited thought"
    assert row["summary"] == "the gist"


async def test_patch_captures_delta_rejects_capture_from_other_citation(
    client: AsyncClient,
) -> None:
    source_id = await _create_source(client)
    target = await _create_citation_with_captures(client, source_id, ["target capture"])
    other = await _create_citation_with_captures(client, source_id, ["foreign capture"])
    foreign_id = other["captures"][0]["id"]

    res = await client.patch(
        f"/rag-api/citations/{target['id']}",
        json={"captures": {"update": [{"id": foreign_id, "text": "hijack"}]}},
    )
    assert res.status_code == 403, res.text

    # The foreign capture is unchanged.
    res = await client.get(f"/rag-api/citations/{other['id']}")
    assert _capture_texts(res.json()["captures"]) == {"foreign capture"}
