"""Integration tests for the embedding → pgvector → search pipeline.

Runs against the real database with fabricated vectors (orthogonal basis
vectors make cosine ranking deterministic). Covers what HTTP smoke can't:
the consolidated vector-search core (ranking, scoring, user scoping, source
filters), the rag_embeddings upsert ON CONFLICT path, and the embedding
service end-to-end with a stub Embedder. The embedding provider itself is
the only thing not exercised.
"""

from collections.abc import AsyncGenerator
from typing import Any

import pytest
import pytest_asyncio
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories.search_repository import SearchRepository
from app.services.takeaway_embedding_service import TakeawayEmbeddingService
from tests import factories
from tests.conftest import OTHER_USER_ID, TEST_USER_ID
from tests.factories import unit_vector


@pytest_asyncio.fixture
async def clean_db(db: AsyncSession) -> AsyncGenerator[AsyncSession, None]:
    await factories.purge_user_data(db, TEST_USER_ID, OTHER_USER_ID)
    yield db
    await factories.purge_user_data(db, TEST_USER_ID, OTHER_USER_ID)


@pytest.mark.asyncio
async def test_vector_search_ranks_by_cosine_similarity(clean_db: AsyncSession) -> None:
    db = clean_db
    src = await factories.create_source(db, TEST_USER_ID)
    near = await factories.create_citation(db, TEST_USER_ID, src, text_="near")
    far = await factories.create_citation(db, TEST_USER_ID, src, text_="far")
    await factories.insert_embedding(
        db, fk_column="citation_id", entity_id=near, vector=unit_vector(0)
    )
    await factories.insert_embedding(
        db, fk_column="citation_id", entity_id=far, vector=unit_vector(1)
    )

    hits = await SearchRepository(db).vector_search_citations(
        embedding=unit_vector(0), user_id=TEST_USER_ID, source_ids=None, source_types=None, limit=10
    )

    assert [h.entity_id for h in hits] == [near, far]
    assert [h.vec_rank for h in hits] == [1, 2]
    assert hits[0].score == pytest.approx(1.0, abs=1e-6)
    assert hits[1].score == pytest.approx(0.0, abs=1e-6)
    assert hits[0].source_title == "Test Source"


@pytest.mark.asyncio
async def test_vector_search_is_scoped_to_user(clean_db: AsyncSession) -> None:
    db = clean_db
    other_src = await factories.create_source(db, OTHER_USER_ID)
    other_cit = await factories.create_citation(db, OTHER_USER_ID, other_src, text_="not yours")
    await factories.insert_embedding(
        db, fk_column="citation_id", entity_id=other_cit, vector=unit_vector(0)
    )

    hits = await SearchRepository(db).vector_search_citations(
        embedding=unit_vector(0), user_id=TEST_USER_ID, source_ids=None, source_types=None, limit=10
    )

    assert hits == []


@pytest.mark.asyncio
async def test_vector_search_source_type_filter(clean_db: AsyncSession) -> None:
    db = clean_db
    book = await factories.create_source(db, TEST_USER_ID, title="Book", type_="book")
    article = await factories.create_source(db, TEST_USER_ID, title="Article", type_="article")
    book_cit = await factories.create_citation(db, TEST_USER_ID, book)
    article_cit = await factories.create_citation(db, TEST_USER_ID, article)
    await factories.insert_embedding(
        db, fk_column="citation_id", entity_id=book_cit, vector=unit_vector(0)
    )
    await factories.insert_embedding(
        db, fk_column="citation_id", entity_id=article_cit, vector=unit_vector(0)
    )

    hits = await SearchRepository(db).vector_search_citations(
        embedding=unit_vector(0),
        user_id=TEST_USER_ID,
        source_ids=None,
        source_types=["book"],
        limit=10,
    )

    assert [h.entity_id for h in hits] == [book_cit]


@pytest.mark.asyncio
async def test_embedding_upsert_replaces_on_conflict(clean_db: AsyncSession) -> None:
    db = clean_db
    src = await factories.create_source(db, TEST_USER_ID)
    cit = await factories.create_citation(db, TEST_USER_ID, src)

    await factories.insert_embedding(
        db, fk_column="citation_id", entity_id=cit, vector=unit_vector(0), model="model-v1"
    )
    await factories.insert_embedding(
        db, fk_column="citation_id", entity_id=cit, vector=unit_vector(1), model="model-v2"
    )

    rows = (
        await db.execute(
            text("SELECT model FROM rag_embeddings WHERE citation_id = :c").bindparams(c=cit)
        )
    ).all()
    assert [r.model for r in rows] == ["model-v2"]


class _UnitVectorEmbedder:
    """Embeds every document as basis vector 2 so search ranking is exact."""

    async def embed_documents(self, texts: list[str]) -> list[list[float]]:
        return [unit_vector(2) for _ in texts]


@pytest.mark.asyncio
async def test_takeaway_embedding_service_end_to_end(clean_db: AsyncSession) -> None:
    """generate() against the real DB: candidate SQL → document → upsert → commit.

    Only the embedding provider is stubbed; the takeaway then becomes findable via real vector
    search, closing the loop from service write to search read.
    """
    db = clean_db
    src = await factories.create_source(db, TEST_USER_ID)
    tk = await factories.create_takeaway(db, TEST_USER_ID, src, title="Embedded takeaway")

    def session_factory() -> Any:
        # The service expects a factory; hand it the test session via a shim
        # that ignores close so the fixture still owns the session lifecycle.
        class _Ctx:
            async def __aenter__(self) -> AsyncSession:
                return db

            async def __aexit__(self, *exc: Any) -> None:
                pass

        return _Ctx()

    service = TakeawayEmbeddingService(
        embedder=_UnitVectorEmbedder(),  # type: ignore[arg-type]
        session_factory=session_factory,  # type: ignore[arg-type]
    )
    await service.generate(tk, TEST_USER_ID)

    hits = await SearchRepository(db).vector_search_takeaways(
        embedding=unit_vector(2), user_id=TEST_USER_ID, source_ids=None, source_types=None, limit=5
    )
    assert [h.entity_id for h in hits] == [tk]
    assert hits[0].takeaway_title == "Embedded takeaway"
