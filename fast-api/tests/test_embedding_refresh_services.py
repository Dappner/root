"""Behavior tests for the single-row embedding generation flow.

Exercises the shared generate path through TakeawayEmbeddingService with
stubbed repository/session/Voyage — no database. Pins the two contracts that
matter: the success path (embed → upsert → commit) and that failures are
logged but never raised (embedding generation must not break the mutation
that triggered it). The CRUD surface around these services is covered by
test_api_smoke.py.
"""

from contextlib import asynccontextmanager
from typing import Any

import pytest

from app.repositories.takeaway_embedding_repository import TakeawayEmbeddingCandidate
from app.services.takeaway_embedding_service import TakeawayEmbeddingService


class FakeSession:
    def __init__(self) -> None:
        self.committed = False

    async def commit(self) -> None:
        self.committed = True


def fake_session_factory(session: FakeSession) -> Any:
    @asynccontextmanager
    async def factory() -> Any:
        yield session

    return factory


class FakeEmbedResult:
    def __init__(self, embeddings: list[list[float]]) -> None:
        self.embeddings = embeddings


class FakeVoyage:
    def __init__(self, embeddings: list[list[float]] | None = None) -> None:
        self.embeddings = embeddings if embeddings is not None else [[0.1, 0.2]]
        self.calls: list[dict[str, Any]] = []

    async def embed(self, *, texts: list[str], model: str, input_type: str) -> FakeEmbedResult:
        self.calls.append({"texts": texts, "model": model, "input_type": input_type})
        return FakeEmbedResult(self.embeddings)


class FakeTakeawayRepo:
    def __init__(self, candidate: TakeawayEmbeddingCandidate | None) -> None:
        self.candidate = candidate
        self.upserts: list[dict[str, Any]] = []

    async def get_candidate(self, db: Any, *, takeaway_id: int, user_id: str) -> Any:
        return self.candidate

    async def upsert_embedding(self, db: Any, **kwargs: Any) -> None:
        self.upserts.append(kwargs)


def _candidate(**overrides: Any) -> TakeawayEmbeddingCandidate:
    defaults: dict[str, Any] = {
        "id": 1,
        "title": "Key insight",
        "body": "The insight body",
        "content_sha256": "sha-1",
        "source_title": "Some Book",
    }
    defaults.update(overrides)
    return TakeawayEmbeddingCandidate(**defaults)


def _service(
    repo: FakeTakeawayRepo, voyage: FakeVoyage, session: FakeSession
) -> TakeawayEmbeddingService:
    return TakeawayEmbeddingService(
        voyage=voyage,  # type: ignore[arg-type]
        session_factory=fake_session_factory(session),
        repository=repo,  # type: ignore[arg-type]
    )


@pytest.mark.asyncio
async def test_generate_embeds_and_upserts() -> None:
    session = FakeSession()
    voyage = FakeVoyage()
    repo = FakeTakeawayRepo(_candidate())

    await _service(repo, voyage, session).generate(1, "user-1")

    assert len(voyage.calls) == 1
    assert "Key insight" in voyage.calls[0]["texts"][0]
    assert len(repo.upserts) == 1
    upsert = repo.upserts[0]
    assert upsert["takeaway_id"] == 1
    assert upsert["content_sha256"] == "sha-1"
    assert upsert["embedding"] == [0.1, 0.2]
    assert session.committed


@pytest.mark.asyncio
async def test_generate_swallows_and_logs_failures() -> None:
    session = FakeSession()
    voyage = FakeVoyage()

    class ExplodingRepo(FakeTakeawayRepo):
        async def get_candidate(self, db: Any, *, takeaway_id: int, user_id: str) -> Any:
            raise RuntimeError("db unavailable")

    repo = ExplodingRepo(_candidate())

    # Must not raise — embedding generation never breaks the triggering mutation.
    await _service(repo, voyage, session).generate(1, "user-1")

    assert repo.upserts == []
    assert not session.committed
