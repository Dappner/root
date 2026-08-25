"""Integration tests for the tags endpoints.

Exercises the routes against a real Postgres database — assumes migrations
have already been applied (``make test-db-up`` in ``go-api``). The ``client``
fixture overrides auth so requests run as ``TEST_USER_ID``.
"""

from __future__ import annotations

import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


async def _create_tag(
    client: AsyncClient, slug: str = "philosophy", label: str = "Philosophy", color: str = "#aabbcc"
) -> dict:
    res = await client.post(
        "/rag-api/tags",
        json={"slug": slug, "label": label, "color": color},
    )
    assert res.status_code == 201, res.text
    body: dict = res.json()
    return body


async def test_create_tag_returns_201(client: AsyncClient) -> None:
    tag = await _create_tag(client)
    assert tag["slug"] == "philosophy"
    assert tag["label"] == "Philosophy"
    assert tag["color"] == "#aabbcc"
    assert isinstance(tag["id"], int)
    assert tag["created_at"]
    assert tag["updated_at"]


async def test_create_tag_rejects_invalid_slug(client: AsyncClient) -> None:
    res = await client.post(
        "/rag-api/tags",
        json={"slug": "Not Kebab", "label": "Bad"},
    )
    assert res.status_code == 400


async def test_create_tag_conflict_on_duplicate_slug(client: AsyncClient) -> None:
    await _create_tag(client, slug="dup", label="First")
    res = await client.post(
        "/rag-api/tags",
        json={"slug": "dup", "label": "Second"},
    )
    assert res.status_code == 409


async def test_list_tags_returns_user_tags_sorted(client: AsyncClient) -> None:
    await _create_tag(client, slug="zeta", label="Zeta")
    await _create_tag(client, slug="alpha", label="Alpha")
    res = await client.get("/rag-api/tags")
    assert res.status_code == 200
    labels = [t["label"] for t in res.json()]
    assert labels == ["Alpha", "Zeta"]


async def test_get_tag_returns_existing(client: AsyncClient) -> None:
    created = await _create_tag(client)
    res = await client.get(f"/rag-api/tags/{created['id']}")
    assert res.status_code == 200
    assert res.json()["id"] == created["id"]


async def test_get_tag_returns_403_for_missing(client: AsyncClient) -> None:
    res = await client.get("/rag-api/tags/99999999")
    assert res.status_code == 403


async def test_update_tag_changes_label_and_color(client: AsyncClient) -> None:
    created = await _create_tag(client, label="Old", color="#000000")
    res = await client.put(
        f"/rag-api/tags/{created['id']}",
        json={"label": "New", "color": "#ffffff"},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["label"] == "New"
    assert body["color"] == "#ffffff"
    assert body["slug"] == created["slug"]  # slug is immutable


async def test_delete_tag_returns_204(client: AsyncClient) -> None:
    created = await _create_tag(client)
    res = await client.delete(f"/rag-api/tags/{created['id']}")
    assert res.status_code == 204
    follow_up = await client.get(f"/rag-api/tags/{created['id']}")
    assert follow_up.status_code == 403


async def test_other_user_cannot_see_or_modify_tag(
    client: AsyncClient, other_user_client: AsyncClient
) -> None:
    created = await _create_tag(client, slug="private", label="Private")

    list_res = await other_user_client.get("/rag-api/tags")
    assert list_res.status_code == 200
    assert all(t["id"] != created["id"] for t in list_res.json())

    get_res = await other_user_client.get(f"/rag-api/tags/{created['id']}")
    assert get_res.status_code == 403

    update_res = await other_user_client.put(
        f"/rag-api/tags/{created['id']}",
        json={"label": "Hijack"},
    )
    assert update_res.status_code == 403

    delete_res = await other_user_client.delete(f"/rag-api/tags/{created['id']}")
    assert delete_res.status_code == 403
