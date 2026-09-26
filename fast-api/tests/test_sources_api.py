"""Integration tests for the source CRUD + enrich endpoints.

DB-backed (require ``TEST_DATABASE_URL``); the ``client`` fixture authenticates
as ``TEST_USER_ID``. conftest only cleans tag rows, so this module adds an
autouse fixture that wipes source-area rows for both test users around each
test (sources + their embeddings/tags).
"""

from __future__ import annotations

from collections.abc import AsyncGenerator

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from tests.conftest import OTHER_USER_ID, TEST_USER_ID

pytestmark = pytest.mark.asyncio


async def _wipe_sources(db: AsyncSession) -> None:
    users = [TEST_USER_ID, OTHER_USER_ID]
    # Embeddings + join rows first, then captures/citations, then sources.
    await db.execute(
        text(
            "DELETE FROM rag_embeddings WHERE source_id IN "
            "(SELECT id FROM sources WHERE user_id = ANY(:u))"
        ).bindparams(u=users)
    )
    await db.execute(
        text(
            "DELETE FROM source_tags WHERE source_id IN "
            "(SELECT id FROM sources WHERE user_id = ANY(:u))"
        ).bindparams(u=users)
    )
    await db.execute(text("DELETE FROM captures WHERE user_id = ANY(:u)").bindparams(u=users))
    await db.execute(text("DELETE FROM citations WHERE user_id = ANY(:u)").bindparams(u=users))
    await db.execute(text("DELETE FROM sources WHERE user_id = ANY(:u)").bindparams(u=users))
    await db.commit()


@pytest_asyncio.fixture(autouse=True)
async def _clean_sources(db: AsyncSession) -> AsyncGenerator[None, None]:
    await _wipe_sources(db)
    yield
    await _wipe_sources(db)


async def _create_source(client: AsyncClient, **overrides: object) -> dict:
    payload: dict = {"title": "Atomic Habits", "type": "book"}
    payload.update(overrides)
    res = await client.post("/rag-api/sources", json=payload)
    assert res.status_code == 201, res.text
    body: dict = res.json()
    return body


async def _create_tag(client: AsyncClient, slug: str, label: str) -> int:
    res = await client.post("/rag-api/tags", json={"slug": slug, "label": label})
    assert res.status_code == 201, res.text
    return int(res.json()["id"])


async def test_create_source_returns_201(client: AsyncClient) -> None:
    body = await _create_source(client)
    assert body["title"] == "Atomic Habits"
    assert body["type"] == "book"
    assert body["status"] == "todo"  # default
    assert isinstance(body["id"], int)


async def test_create_duplicate_returns_409(client: AsyncClient) -> None:
    await _create_source(client, title="Dup Title", type="book")
    res = await client.post(
        "/rag-api/sources",
        json={"title": "  dup title  ", "type": "book"},  # case-insensitive + trimmed
    )
    assert res.status_code == 409, res.text


async def test_create_invalid_metadata_returns_400(client: AsyncClient) -> None:
    res = await client.post(
        "/rag-api/sources",
        json={"title": "Bad Book", "type": "book", "metadata": {"pages": "not-a-number"}},
    )
    assert res.status_code == 400, res.text


async def test_create_normalizes_article_url(client: AsyncClient) -> None:
    body = await _create_source(
        client,
        title="An Article",
        type="article",
        metadata={"url": "https://Example.com/a/?utm=x#frag"},
    )
    assert body["metadata"]["url"] == "https://example.com/a"


async def test_update_put_merge_preserves_omitted(client: AsyncClient) -> None:
    created = await _create_source(client, title="Original", type="book")
    res = await client.put(
        f"/rag-api/sources/{created['id']}",
        json={"title": "Renamed"},  # type omitted -> preserved
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["title"] == "Renamed"
    assert body["type"] == "book"


async def test_update_tag_ids_none_untouched(client: AsyncClient) -> None:
    tag_id = await _create_tag(client, "keep", "Keep")
    created = await _create_source(client)
    await client.put(f"/rag-api/sources/{created['id']}", json={"tag_ids": [tag_id]})
    # tag_ids omitted entirely -> untouched
    res = await client.put(f"/rag-api/sources/{created['id']}", json={"title": "New"})
    assert res.status_code == 200
    assert res.json()["tag_ids"] == [tag_id]


async def test_update_tag_ids_empty_clears(client: AsyncClient) -> None:
    tag_id = await _create_tag(client, "clearme", "ClearMe")
    created = await _create_source(client)
    await client.put(f"/rag-api/sources/{created['id']}", json={"tag_ids": [tag_id]})
    res = await client.put(f"/rag-api/sources/{created['id']}", json={"tag_ids": []})
    assert res.status_code == 200
    assert res.json()["tag_ids"] == []


async def test_update_tag_ids_list_sets(client: AsyncClient) -> None:
    a = await _create_tag(client, "a", "A")
    b = await _create_tag(client, "b", "B")
    created = await _create_source(client)
    res = await client.put(f"/rag-api/sources/{created['id']}", json={"tag_ids": [a, b]})
    assert res.status_code == 200
    assert sorted(res.json()["tag_ids"]) == sorted([a, b])


async def test_update_unowned_tag_returns_403(
    client: AsyncClient, other_user_client: AsyncClient
) -> None:
    # Tag owned by the other user.
    res = await other_user_client.post("/rag-api/tags", json={"slug": "theirs", "label": "Theirs"})
    assert res.status_code == 201, res.text
    other_tag_id = int(res.json()["id"])

    created = await _create_source(client)
    res = await client.put(f"/rag-api/sources/{created['id']}", json={"tag_ids": [other_tag_id]})
    assert res.status_code == 403, res.text


async def test_list_sources_counts_shape(client: AsyncClient) -> None:
    await _create_source(client, title="Book One", type="book")
    await _create_source(client, title="Art One", type="article")
    res = await client.get("/rag-api/sources")
    assert res.status_code == 200, res.text
    body = res.json()
    counts = body["metadata"]["counts"]
    assert set(counts.keys()) == {"all", "book", "article", "video", "podcast", "pdf"}
    assert counts["all"] == len(body["sources"])
    assert counts["book"] == 1
    assert counts["article"] == 1


async def test_list_sources_cache_invalidates_after_create(client: AsyncClient) -> None:
    await _create_source(client, title="Book One", type="book")
    first = await client.get("/rag-api/sources")
    assert first.status_code == 200, first.text
    assert first.json()["metadata"]["counts"]["all"] == 1

    await _create_source(client, title="Book Two", type="book")
    second = await client.get("/rag-api/sources")
    assert second.status_code == 200, second.text
    assert second.json()["metadata"]["counts"]["all"] == 2


async def test_delete_source_returns_204_then_get_403(client: AsyncClient) -> None:
    created = await _create_source(client)
    res = await client.delete(f"/rag-api/sources/{created['id']}")
    assert res.status_code == 204, res.text
    res = await client.get(f"/rag-api/sources/{created['id']}")
    assert res.status_code == 403


async def test_get_unowned_source_returns_403(client: AsyncClient) -> None:
    res = await client.get("/rag-api/sources/99999999")
    assert res.status_code == 403


def _pdf_bytes(pages: int) -> bytes:
    import io

    from pypdf import PdfWriter

    writer = PdfWriter()
    for _ in range(pages):
        writer.add_blank_page(width=612, height=792)
    buf = io.BytesIO()
    writer.write(buf)
    return buf.getvalue()


async def test_pdf_upload_stores_page_count_and_serves_url(client: AsyncClient) -> None:
    """Regression: page_count was stripped on upload and never set, so the viewer
    (which keys "has a PDF" off it) always showed "No PDF uploaded"."""
    created = await _create_source(client, title="Paper", type="pdf")
    data = _pdf_bytes(3)

    res = await client.post(
        f"/rag-api/sources/{created['id']}/pdf",
        files={"file": ("paper.pdf", data, "application/pdf")},
    )
    assert res.status_code == 200, res.text

    source = (await client.get(f"/rag-api/sources/{created['id']}")).json()
    assert source["metadata"]["page_count"] == 3
    assert source["metadata"]["size_bytes"] == len(data)
    url = await client.get(f"/rag-api/sources/{created['id']}/pdf/url")
    assert url.status_code == 200, url.text


async def test_pdf_upload_rejects_unreadable_file(client: AsyncClient) -> None:
    created = await _create_source(client, title="Not a PDF", type="pdf")
    res = await client.post(
        f"/rag-api/sources/{created['id']}/pdf",
        files={"file": ("fake.pdf", b"%PDF-1.4 garbage", "application/pdf")},
    )
    assert res.status_code == 400, res.text
