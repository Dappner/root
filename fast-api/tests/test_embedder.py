"""Embedder seam: the fake's contract and provider selection."""

import math

import pytest

from app.core.config import Settings
from app.integrations.voyage import VoyageEmbedder
from app.providers.embedder import EMBEDDING_DIM, FakeEmbedder, create_embedder


@pytest.mark.asyncio
async def test_fake_embedder_is_deterministic_normalised_and_ordered() -> None:
    embedder = FakeEmbedder()
    docs = await embedder.embed_documents(["alpha beta", "gamma"])
    again = await FakeEmbedder().embed_documents(["alpha beta", "gamma"])

    assert docs == again
    assert [len(v) for v in docs] == [EMBEDDING_DIM, EMBEDDING_DIM]
    assert math.isclose(sum(x * x for x in docs[0]), 1.0)
    # Query and document vectors share one space.
    assert await embedder.embed_query("alpha beta") == docs[0]


@pytest.mark.asyncio
async def test_fake_rerank_scores_every_document_highest_first() -> None:
    results = await FakeEmbedder().rerank(
        "compounding curiosity", ["weather", "curiosity compounds"]
    )

    assert [r.index for r in results] == [1, 0]
    assert results[0].score > results[1].score == 0


def test_create_embedder_selects_provider() -> None:
    base = {"database_url": "postgresql://t:t@localhost/t"}
    assert isinstance(create_embedder(Settings(**base, embedding_provider="fake")), FakeEmbedder)
    voyage = create_embedder(Settings(**base, embedding_provider="voyage", embedding_api_key="k"))
    assert isinstance(voyage, VoyageEmbedder)
    with pytest.raises(ValueError):
        create_embedder(Settings(**base, embedding_provider="nope"))


def test_voyage_key_required_only_for_voyage_provider() -> None:
    r2 = {
        f"r2_{k}": "x"
        for k in ("account_id", "access_key_id", "secret_access_key", "bucket_name", "endpoint_url")
    }
    base = {"database_url": "postgresql://t:t@localhost/t", **r2}
    Settings(**base, embedding_provider="fake").validate_startup_config()
    with pytest.raises(RuntimeError, match="embedding_api_key"):
        Settings(
            **base, embedding_provider="voyage", embedding_api_key=""
        ).validate_startup_config()
