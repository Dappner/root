from __future__ import annotations

from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from pydantic import BaseModel

from app.core.routing import APIRouter


class OptionalFieldResponse(BaseModel):
    required: str
    optional: str | None = None


async def test_project_router_omits_none_response_fields() -> None:
    app = FastAPI()
    router = APIRouter()

    @router.get("/payload", response_model=OptionalFieldResponse)
    async def get_payload() -> OptionalFieldResponse:
        return OptionalFieldResponse(required="value")

    app.include_router(router)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/payload")

    assert response.status_code == 200
    assert response.json() == {"required": "value"}
