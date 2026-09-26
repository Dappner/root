"""Integration tests for the source-section CRUD + reorder endpoints.

DB-backed (require ``TEST_DATABASE_URL``). The ``client`` fixture authenticates
as ``TEST_USER_ID``; ``other_user_client`` as ``OTHER_USER_ID``. An autouse
fixture wipes section/source/embedding rows for both users around each test.

Embedding generation is scheduled via ``BackgroundTasks`` and would call the embedder;
we override the section embedding service factory to a no-op so tests don't make
network calls. Embedding *row* deletion happens in-tx (no embedder) and is asserted
directly against ``rag_embeddings``.
"""

from __future__ import annotations

import hashlib
from collections.abc import AsyncGenerator

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api import sections as sections_api
from tests.conftest import OTHER_USER_ID, TEST_USER_ID

pytestmark = pytest.mark.asyncio


async def _wipe(db: AsyncSession) -> None:
    users = [TEST_USER_ID, OTHER_USER_ID]
    await db.execute(
        text(
            "DELETE FROM rag_embeddings WHERE source_id IN "
            "(SELECT id FROM sources WHERE user_id = ANY(:u))"
        ).bindparams(u=users)
    )
    await db.execute(
        text(
            "DELETE FROM source_sections WHERE source_id IN "
            "(SELECT id FROM sources WHERE user_id = ANY(:u))"
        ).bindparams(u=users)
    )
    await db.execute(text("DELETE FROM sources WHERE user_id = ANY(:u)").bindparams(u=users))
    await db.commit()


@pytest_asyncio.fixture(autouse=True)
async def _clean(db: AsyncSession) -> AsyncGenerator[None, None]:
    await _wipe(db)
    yield
    await _wipe(db)


@pytest.fixture(autouse=True)
def _no_embedding(monkeypatch: pytest.MonkeyPatch) -> None:
    """Stub the embedding service so scheduled background tasks don't run."""

    class _Noop:
        async def generate(self, section_id: int, user_id: str) -> None:
            return None

    monkeypatch.setattr(sections_api, "_section_summary_embedding_service", lambda: _Noop())


async def _create_source(client: AsyncClient, **overrides: object) -> dict:
    payload: dict = {"title": "Atomic Habits", "type": "book"}
    payload.update(overrides)
    res = await client.post("/rag-api/sources", json=payload)
    assert res.status_code == 201, res.text
    return res.json()


async def _create_section(client: AsyncClient, source_id: int, **fields: object) -> dict:
    payload: dict = {"title": "Section A"}
    payload.update(fields)
    res = await client.post(f"/rag-api/sources/{source_id}/sections", json=payload)
    assert res.status_code == 201, res.text
    return res.json()


async def _embedding_count(db: AsyncSession, section_id: int) -> int:
    res = await db.execute(
        text("SELECT COUNT(*) FROM rag_embeddings WHERE section_id = :id").bindparams(id=section_id)
    )
    return int(res.scalar_one())


async def _summary_hash(db: AsyncSession, section_id: int) -> str | None:
    res = await db.execute(
        text("SELECT summary_sha256 FROM source_sections WHERE id = :id").bindparams(id=section_id)
    )
    return res.scalar_one_or_none()


# --- create ---------------------------------------------------------------


async def test_create_without_summary(client: AsyncClient, db: AsyncSession) -> None:
    src = await _create_source(client)
    body = await _create_section(client, src["id"], title="  Intro  ")
    assert body["title"] == "Intro"  # trimmed
    assert body.get("summary") is None
    assert body["order_index"] == 0
    assert body["generated_by"] == "user"
    assert await _summary_hash(db, body["id"]) is None


async def test_create_with_summary_sets_hash(client: AsyncClient, db: AsyncSession) -> None:
    src = await _create_source(client)
    body = await _create_section(
        client, src["id"], title="Chapter 1", subtitle="The Beginning", summary="It starts here."
    )
    expected = hashlib.sha256(
        "Chapter 1 - The Beginning - It starts here.".encode("utf-8")
    ).hexdigest()
    assert await _summary_hash(db, body["id"]) == expected


async def test_create_order_index_increments(client: AsyncClient) -> None:
    src = await _create_source(client)
    a = await _create_section(client, src["id"], title="A")
    b = await _create_section(client, src["id"], title="B")
    assert a["order_index"] == 0
    assert b["order_index"] == 1


async def test_create_range_end_before_start_400(client: AsyncClient) -> None:
    src = await _create_source(client)
    res = await client.post(
        f"/rag-api/sources/{src['id']}/sections",
        json={"title": "Bad", "range_start": 10, "range_end": 5},
    )
    assert res.status_code in (400, 422), res.text


async def test_create_empty_title_400(client: AsyncClient) -> None:
    src = await _create_source(client)
    res = await client.post(f"/rag-api/sources/{src['id']}/sections", json={"title": "   "})
    # trimmed-empty is a business-rule 400 (passes min_length=1 since whitespace
    # is non-empty on the wire).
    assert res.status_code == 400, res.text


# --- get ------------------------------------------------------------------


async def test_get_section(client: AsyncClient) -> None:
    src = await _create_source(client)
    sec = await _create_section(client, src["id"], title="Find Me")
    res = await client.get(f"/rag-api/sources/{src['id']}/sections/{sec['id']}")
    assert res.status_code == 200, res.text
    assert res.json()["title"] == "Find Me"


async def test_get_cross_source_section_404(client: AsyncClient) -> None:
    src_a = await _create_source(client, title="A", type="book")
    src_b = await _create_source(client, title="B", type="book")
    sec = await _create_section(client, src_a["id"], title="Belongs to A")
    # Same owner, wrong source -> 404 (doesn't leak the section's real source).
    res = await client.get(f"/rag-api/sources/{src_b['id']}/sections/{sec['id']}")
    assert res.status_code == 404, res.text


async def test_get_unowned_source_403(client: AsyncClient, other_user_client: AsyncClient) -> None:
    src = await _create_source(client)
    sec = await _create_section(client, src["id"], title="Mine")
    res = await other_user_client.get(f"/rag-api/sources/{src['id']}/sections/{sec['id']}")
    assert res.status_code == 403, res.text


# --- update (PATCH merge) -------------------------------------------------


async def test_patch_omit_preserves_fields(client: AsyncClient, db: AsyncSession) -> None:
    src = await _create_source(client)
    sec = await _create_section(
        client, src["id"], title="Orig", subtitle="Sub", summary="Body", range_start=1, range_end=9
    )
    # PATCH with only title -> all other fields preserved.
    res = await client.patch(
        f"/rag-api/sources/{src['id']}/sections/{sec['id']}", json={"title": "Renamed"}
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["title"] == "Renamed"
    assert body["subtitle"] == "Sub"
    assert body["summary"] == "Body"
    assert body["range_start"] == 1
    assert body["range_end"] == 9
    # Summary still present -> hash recomputed against new title.
    expected = hashlib.sha256("Renamed - Sub - Body".encode("utf-8")).hexdigest()
    assert await _summary_hash(db, sec["id"]) == expected


async def test_patch_empty_string_clears_summary_and_deletes_embedding(
    client: AsyncClient, db: AsyncSession
) -> None:
    src = await _create_source(client)
    sec = await _create_section(client, src["id"], title="T", summary="Has summary")
    # Seed an embedding row to prove the in-tx delete fires.
    # rag_embeddings has a CHECK constraint that exactly one FK column is set,
    # so only `section_id` may be populated here.
    await db.execute(
        text(
            "INSERT INTO rag_embeddings (section_id, content_sha256, embedding, model, "
            "created_at) VALUES (:sid, 'deadbeef', CAST(:vec AS vector), 'test-model', NOW())"
        ).bindparams(sid=sec["id"], vec="[" + ",".join(["0"] * 1024) + "]")
    )
    await db.commit()
    assert await _embedding_count(db, sec["id"]) == 1

    res = await client.patch(
        f"/rag-api/sources/{src['id']}/sections/{sec['id']}", json={"title": "T", "summary": ""}
    )
    assert res.status_code == 200, res.text
    assert res.json().get("summary") is None
    assert await _summary_hash(db, sec["id"]) is None
    assert await _embedding_count(db, sec["id"]) == 0


async def test_patch_range_validation_400(client: AsyncClient) -> None:
    src = await _create_source(client)
    sec = await _create_section(client, src["id"], title="T", range_start=2, range_end=8)
    res = await client.patch(
        f"/rag-api/sources/{src['id']}/sections/{sec['id']}",
        json={"title": "T", "range_end": 1},  # merged: start=2, end=1 -> invalid
    )
    assert res.status_code == 400, res.text


# --- delete ---------------------------------------------------------------


async def test_delete_section_204(client: AsyncClient) -> None:
    src = await _create_source(client)
    sec = await _create_section(client, src["id"], title="Del")
    res = await client.delete(f"/rag-api/sources/{src['id']}/sections/{sec['id']}")
    assert res.status_code == 204, res.text
    res = await client.get(f"/rag-api/sources/{src['id']}/sections/{sec['id']}")
    assert res.status_code == 404


# --- reorder --------------------------------------------------------------


async def test_reorder_partial_set(client: AsyncClient) -> None:
    src = await _create_source(client)
    a = await _create_section(client, src["id"], title="A")
    b = await _create_section(client, src["id"], title="B")
    c = await _create_section(client, src["id"], title="C")
    # Reorder only b,a (partial set, c omitted).
    res = await client.put(
        f"/rag-api/sources/{src['id']}/sections/reorder",
        json={"section_ids": [b["id"], a["id"]]},
    )
    assert res.status_code == 204, res.text

    listed = (await client.get(f"/rag-api/sources/{src['id']}/sections")).json()
    by_id = {s["id"]: s["order_index"] for s in listed}
    assert by_id[b["id"]] == 0
    assert by_id[a["id"]] == 1
    assert by_id[c["id"]] == 2  # untouched (was created third)


async def test_reorder_unknown_id_404(client: AsyncClient) -> None:
    src = await _create_source(client)
    a = await _create_section(client, src["id"], title="A")
    res = await client.put(
        f"/rag-api/sources/{src['id']}/sections/reorder",
        json={"section_ids": [a["id"], 99999999]},
    )
    assert res.status_code == 404, res.text


async def test_reorder_empty_422(client: AsyncClient) -> None:
    src = await _create_source(client)
    res = await client.put(
        f"/rag-api/sources/{src['id']}/sections/reorder", json={"section_ids": []}
    )
    assert res.status_code == 422, res.text  # min_length=1 schema rejection
