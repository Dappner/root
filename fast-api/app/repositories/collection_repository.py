"""Collection repository — query primitives over `collections` and
`collection_sources`. Reads return (Collection, source_count) tuples so
the service doesn't have to issue a second query for the count.
"""

from __future__ import annotations

from sqlalchemy import delete, func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.datetime_utils import utcnow
from app.models.database import Collection, CollectionSource


class CollectionRepository:
    async def create(self, db: AsyncSession, collection: Collection) -> Collection:
        db.add(collection)
        await db.flush()
        return collection

    async def get(
        self,
        db: AsyncSession,
        *,
        collection_id: int,
        user_id: str,
    ) -> tuple[Collection, int] | None:
        stmt = (
            select(Collection, func.count(CollectionSource.source_id).label("source_count"))
            .outerjoin(CollectionSource, CollectionSource.collection_id == Collection.id)
            .where(Collection.id == collection_id, Collection.user_id == user_id)
            .group_by(Collection.id)
        )
        row = (await db.execute(stmt)).first()
        if row is None:
            return None
        collection, source_count = row
        return collection, int(source_count or 0)

    async def list_for_user(
        self, db: AsyncSession, *, user_id: str
    ) -> list[tuple[Collection, int]]:
        stmt = (
            select(Collection, func.count(CollectionSource.source_id).label("source_count"))
            .outerjoin(CollectionSource, CollectionSource.collection_id == Collection.id)
            .where(Collection.user_id == user_id)
            .group_by(Collection.id)
            .order_by(Collection.updated_at.desc())
        )
        rows = (await db.execute(stmt)).all()
        return [(c, int(count or 0)) for c, count in rows]

    async def delete(self, db: AsyncSession, *, collection: Collection) -> None:
        await db.delete(collection)
        await db.flush()

    async def add_source(self, db: AsyncSession, *, collection_id: int, source_id: int) -> None:
        # Idempotent — calling twice is not an error; the second call is a no-op.
        stmt = pg_insert(CollectionSource).values(
            collection_id=collection_id,
            source_id=source_id,
            created_at=utcnow(),
        )
        stmt = stmt.on_conflict_do_nothing(index_elements=["collection_id", "source_id"])
        await db.execute(stmt)
        await db.flush()

    async def remove_source(self, db: AsyncSession, *, collection_id: int, source_id: int) -> None:
        await db.execute(
            delete(CollectionSource).where(
                CollectionSource.collection_id == collection_id,
                CollectionSource.source_id == source_id,
            )
        )
        await db.flush()

    async def list_source_ids(self, db: AsyncSession, *, collection_id: int) -> list[int]:
        stmt = (
            select(CollectionSource.source_id)
            .where(CollectionSource.collection_id == collection_id)
            .order_by(CollectionSource.created_at.desc())
        )
        result = await db.execute(stmt)
        return [int(row[0]) for row in result.all()]
