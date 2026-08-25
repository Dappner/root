"""Tests for the curated model catalog endpoint."""

from httpx import ASGITransport, AsyncClient

from app.main import app
from app.schemas.model_catalog import MODEL_CATALOG


async def test_model_catalog_is_cacheable_and_matches_backend_catalog():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/rag-api/ask/models")

    assert response.status_code == 200
    assert response.json() == MODEL_CATALOG.model_dump(mode="json")
    assert response.headers["cache-control"] == (
        "public, max-age=86400, stale-while-revalidate=604800"
    )
    assert response.headers["etag"] == f'"model-catalog-{MODEL_CATALOG.version}"'


async def test_model_catalog_supports_conditional_get():
    etag = f'"model-catalog-{MODEL_CATALOG.version}"'
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/rag-api/ask/models", headers={"If-None-Match": etag})

    assert response.status_code == 304
    assert response.content == b""
    assert response.headers["etag"] == etag
