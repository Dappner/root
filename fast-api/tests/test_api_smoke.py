"""CRUD smoke walk across the fast-api-owned entities.

One generic walk — create → get → list → update → cross-user denial → delete →
404 — driven by a small spec per entity (captures, citations, notes,
collections, takeaways), plus a read-only sweep over the aggregate endpoints.
The goal is maximum surface per test line: any 500 in the
router→schema→service→repository→model stack fails here, including
SQLAlchemy-model vs database-schema drift.

Requires TEST_DATABASE_URL (see conftest). Tags have their own walk in
test_tags_api.py.
"""

from __future__ import annotations

from collections.abc import AsyncGenerator, Callable
from dataclasses import dataclass
from typing import Any

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from tests import factories
from tests.conftest import OTHER_USER_ID, TEST_USER_ID


@pytest_asyncio.fixture
async def source_id(db: AsyncSession) -> AsyncGenerator[int, None]:
    """Seed one source for TEST_USER_ID; deleting it cascades child rows."""
    await factories.purge_user_data(db, TEST_USER_ID, OTHER_USER_ID)
    sid = await factories.create_source(db, TEST_USER_ID, title="Smoke Source")

    yield sid

    await factories.purge_user_data(db, TEST_USER_ID, OTHER_USER_ID)


@dataclass
class CrudSpec:
    """How to walk one entity's CRUD surface. Paths are full /rag-api URLs."""

    name: str
    create_path: str
    create_json: dict[str, Any]
    detail_path: Callable[[int], str]
    list_path: str
    update_method: str
    update_json: dict[str, Any]
    id_from: Callable[[dict[str, Any]], int] = lambda body: body["id"]
    # Captures expose no GET-detail route (list-by-source only).
    has_detail_get: bool = True


def _specs(src: int) -> list[CrudSpec]:
    return [
        CrudSpec(
            name="captures",
            create_path="/rag-api/captures",
            create_json={"text": "smoke capture", "source_id": src},
            detail_path=lambda i: f"/rag-api/captures/{i}",
            list_path=f"/rag-api/sources/{src}/captures",
            update_method="PUT",
            update_json={"text": "smoke capture v2", "source_id": src},
            id_from=lambda body: body["capture"]["id"],
            has_detail_get=False,
        ),
        CrudSpec(
            name="citations",
            create_path="/rag-api/citations",
            create_json={"text": "smoke citation", "source_id": src},
            detail_path=lambda i: f"/rag-api/citations/{i}",
            list_path="/rag-api/citations",
            update_method="PATCH",
            update_json={"text": "smoke citation v2"},
            id_from=lambda body: body["citation"]["id"],
        ),
        CrudSpec(
            name="notes",
            create_path="/rag-api/notes",
            create_json={"title": "smoke note", "body": {"type": "doc", "content": []}},
            detail_path=lambda i: f"/rag-api/notes/{i}",
            list_path="/rag-api/notes",
            update_method="PUT",
            update_json={"title": "smoke note v2", "body": {"type": "doc", "content": []}},
        ),
        CrudSpec(
            name="collections",
            create_path="/rag-api/collections",
            create_json={"name": "smoke collection"},
            detail_path=lambda i: f"/rag-api/collections/{i}",
            list_path="/rag-api/collections",
            update_method="PUT",
            update_json={"name": "smoke collection v2"},
        ),
        CrudSpec(
            name="takeaways",
            create_path=f"/rag-api/sources/{src}/takeaways",
            create_json={"title": "smoke takeaway"},
            detail_path=lambda i: f"/rag-api/sources/{src}/takeaways/{i}",
            list_path=f"/rag-api/sources/{src}/takeaways",
            update_method="PUT",
            update_json={"title": "smoke takeaway v2"},
        ),
    ]


ENTITY_NAMES = [s.name for s in _specs(0)]


@pytest.mark.parametrize("entity", ENTITY_NAMES)
@pytest.mark.asyncio
async def test_crud_walk(
    client: AsyncClient,
    other_user_client: AsyncClient,
    source_id: int,
    entity: str,
) -> None:
    spec = next(s for s in _specs(source_id) if s.name == entity)

    # Create
    res = await client.post(spec.create_path, json=spec.create_json)
    assert res.status_code == 201, f"create: {res.status_code} {res.text}"
    obj_id = spec.id_from(res.json())

    # Read: detail + list
    if spec.has_detail_get:
        res = await client.get(spec.detail_path(obj_id))
        assert res.status_code == 200, f"detail: {res.status_code} {res.text}"
    res = await client.get(spec.list_path)
    assert res.status_code == 200, f"list: {res.status_code} {res.text}"

    # Update
    res = await client.request(
        spec.update_method, spec.detail_path(obj_id), json=spec.update_json
    )
    assert res.status_code == 200, f"update: {res.status_code} {res.text}"

    # Cross-user: read and delete must be denied (403/404), never 5xx
    if spec.has_detail_get:
        res = await other_user_client.get(spec.detail_path(obj_id))
        assert res.status_code in (403, 404), f"cross-user read: {res.status_code} {res.text}"
    res = await other_user_client.delete(spec.detail_path(obj_id))
    assert res.status_code in (403, 404), f"cross-user delete: {res.status_code} {res.text}"

    # Owner delete; the row must then read as gone. Some entities report
    # missing rows as 403 (ownership helpers), others as 404 — both are
    # acceptable here, a 2xx or 5xx is not.
    res = await client.delete(spec.detail_path(obj_id))
    assert res.status_code in (200, 204), f"delete: {res.status_code} {res.text}"
    if spec.has_detail_get:
        res = await client.get(spec.detail_path(obj_id))
    else:
        res = await client.delete(spec.detail_path(obj_id))
    assert res.status_code in (403, 404), f"after delete: {res.status_code} {res.text}"


READ_ONLY_PATHS = [
    "/rag-api/home",
    "/rag-api/me/stats",
    "/rag-api/graph",
    "/rag-api/takeaways/recent",
    "/rag-api/notes",
    "/rag-api/citations",
    "/rag-api/collections",
]


@pytest.mark.parametrize("path", READ_ONLY_PATHS)
@pytest.mark.asyncio
async def test_read_endpoints_smoke(client: AsyncClient, source_id: int, path: str) -> None:
    res = await client.get(path)
    assert res.status_code == 200, f"{path}: {res.status_code} {res.text}"
