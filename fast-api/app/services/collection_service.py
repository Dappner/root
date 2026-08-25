"""Collection service. Ownership checks and validation; transaction boundary
is owned by the request via `get_db` autocommit."""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.datetime_utils import utcnow
from app.core.exceptions import NotFoundError, ValidationError
from app.core.ownership import require_source
from app.models.database import Collection
from app.repositories.collection_repository import CollectionRepository
from app.services.source_list_cache import invalidate_source_list_cache


class CollectionService:
    def __init__(self) -> None:
        self._repo = CollectionRepository()

    # ---------- reads ----------

    async def get(
        self, *, db: AsyncSession, user_id: str, collection_id: int
    ) -> tuple[Collection, int]:
        row = await self._repo.get(db, collection_id=collection_id, user_id=user_id)
        if row is None:
            raise NotFoundError("collection not found")
        return row

    async def list_for_user(
        self, *, db: AsyncSession, user_id: str
    ) -> list[tuple[Collection, int]]:
        return await self._repo.list_for_user(db, user_id=user_id)

    async def list_source_ids(
        self, *, db: AsyncSession, user_id: str, collection_id: int
    ) -> list[int]:
        # Ownership: collection must belong to user.
        await self.get(db=db, user_id=user_id, collection_id=collection_id)
        return await self._repo.list_source_ids(db, collection_id=collection_id)

    # ---------- writes ----------

    async def create(
        self,
        *,
        db: AsyncSession,
        user_id: str,
        name: str,
        description: str | None,
    ) -> tuple[Collection, int]:
        name = name.strip()
        if not name:
            raise ValidationError("name must not be empty")

        now = utcnow()
        collection = Collection(
            user_id=user_id,
            name=name,
            description=description,
            created_at=now,
            updated_at=now,
        )
        created = await self._repo.create(db, collection)
        await db.flush()
        await db.refresh(created)
        # Just-created → no sources yet.
        return created, 0

    async def update(
        self,
        *,
        db: AsyncSession,
        user_id: str,
        collection_id: int,
        name: str,
        description: str | None,
    ) -> tuple[Collection, int]:
        collection, _ = await self.get(db=db, user_id=user_id, collection_id=collection_id)

        name = name.strip()
        if not name:
            raise ValidationError("name must not be empty")

        collection.name = name
        collection.description = description
        collection.updated_at = utcnow()

        await db.flush()
        await db.refresh(collection)
        # Re-fetch so the response carries the joined source_count.
        return await self.get(db=db, user_id=user_id, collection_id=collection.id)

    async def delete(self, *, db: AsyncSession, user_id: str, collection_id: int) -> None:
        collection, _ = await self.get(db=db, user_id=user_id, collection_id=collection_id)
        await self._repo.delete(db, collection=collection)

    async def add_source(
        self,
        *,
        db: AsyncSession,
        user_id: str,
        collection_id: int,
        source_id: int,
    ) -> None:
        # Both sides need ownership verification — collection AND source.
        await self.get(db=db, user_id=user_id, collection_id=collection_id)
        await require_source(db, source_id, user_id)
        await self._repo.add_source(db, collection_id=collection_id, source_id=source_id)
        await invalidate_source_list_cache(user_id)

    async def remove_source(
        self,
        *,
        db: AsyncSession,
        user_id: str,
        collection_id: int,
        source_id: int,
    ) -> None:
        await self.get(db=db, user_id=user_id, collection_id=collection_id)
        # No ownership check on source for removal — if it's already in the
        # collection (which we own) the join row is ours to remove regardless
        # of whether the source still exists.
        await self._repo.remove_source(db, collection_id=collection_id, source_id=source_id)
        await invalidate_source_list_cache(user_id)
