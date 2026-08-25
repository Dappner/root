"""DB population helpers for integration tests.

Pure data setup — no assertions. Tests compose these to build the state they
need, then run requests or repository calls against it. All helpers commit so
the rows are visible to API-spawned sessions and background tasks.

Embeddings are fabricated vectors (no Voyage involved): anything downstream of
"we have a vector" — the upsert, pgvector storage, cosine ranking, user
scoping — is real. `insert_embedding` goes through the production
`upsert_rag_embedding` helper on purpose, so its ON CONFLICT path is exercised
against the real schema.
"""

from __future__ import annotations

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.datetime_utils import utcnow
from app.models.database import Capture, Citation, Source, SourceTakeaway
from app.repositories._rag_embedding_upsert import upsert_rag_embedding

EMBEDDING_DIM = 1024


def unit_vector(axis: int) -> list[float]:
    """A 1024-dim basis vector. Distinct axes are orthogonal (cosine score 0);
    the same axis is identical (cosine score 1) — handy for ranking tests."""
    v = [0.0] * EMBEDDING_DIM
    v[axis] = 1.0
    return v


async def purge_user_data(db: AsyncSession, *user_ids: str) -> None:
    """Remove all content rows for the given users.

    Deleting sources cascades captures, citations, takeaways, sections, and
    their rag_embeddings; notes and collections hang off the user directly.
    """
    for uid in user_ids:
        await db.execute(text("DELETE FROM notes WHERE user_id = :u").bindparams(u=uid))
        await db.execute(text("DELETE FROM collections WHERE user_id = :u").bindparams(u=uid))
        await db.execute(text("DELETE FROM citations WHERE user_id = :u").bindparams(u=uid))
        await db.execute(text("DELETE FROM sources WHERE user_id = :u").bindparams(u=uid))
    await db.commit()


async def create_source(
    db: AsyncSession,
    user_id: str,
    *,
    title: str = "Test Source",
    type_: str = "article",
    status: str = "todo",
) -> int:
    source = Source(
        user_id=user_id,
        title=title,
        type=type_,
        status=status,
        created_at=utcnow(),
        updated_at=utcnow(),
    )
    db.add(source)
    await db.commit()
    return source.id


async def create_citation(
    db: AsyncSession,
    user_id: str,
    source_id: int | None,
    *,
    text_: str = "Test citation",
    info_type: str = "quote",
) -> int:
    citation = Citation(
        user_id=user_id,
        source_id=source_id,
        text=text_,
        info_type=info_type,
        created_at=utcnow(),
        updated_at=utcnow(),
    )
    db.add(citation)
    await db.commit()
    return citation.id


async def create_capture(
    db: AsyncSession,
    user_id: str,
    source_id: int | None,
    *,
    content: str = "Test capture",
    citation_id: int | None = None,
) -> int:
    capture = Capture(
        user_id=user_id,
        source_id=source_id,
        citation_id=citation_id,
        content=content,
        created_at=utcnow(),
        updated_at=utcnow(),
    )
    db.add(capture)
    await db.commit()
    return capture.id


async def create_takeaway(
    db: AsyncSession,
    user_id: str,
    source_id: int,
    *,
    title: str = "Test takeaway",
    body: str = "Test takeaway body",
    content_sha256: str | None = "t" * 64,
) -> int:
    takeaway = SourceTakeaway(
        user_id=user_id,
        source_id=source_id,
        title=title,
        body=body,
        content_sha256=content_sha256,
        created_at=utcnow(),
        updated_at=utcnow(),
    )
    db.add(takeaway)
    await db.commit()
    return takeaway.id


async def insert_embedding(
    db: AsyncSession,
    *,
    fk_column: str,
    entity_id: int,
    vector: list[float],
    model: str = "test-model",
    content_sha256: str = "0" * 64,
) -> None:
    """Store an embedding row via the production upsert helper."""
    await upsert_rag_embedding(
        db,
        fk_column=fk_column,
        entity_id=entity_id,
        content_sha256=content_sha256,
        embedding=vector,
        model=model,
        created_at=utcnow(),
    )
    await db.commit()
