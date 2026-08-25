from __future__ import annotations

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.database import Tag


class TagRepository:
    async def create(self, db: AsyncSession, tag: Tag) -> Tag:
        db.add(tag)
        await db.flush()
        return tag

    async def get(self, db: AsyncSession, tag_id: int, user_id: str) -> Tag | None:
        result = await db.execute(select(Tag).where(Tag.id == tag_id, Tag.user_id == user_id))
        return result.scalar_one_or_none()

    async def list_for_user(self, db: AsyncSession, user_id: str) -> list[Tag]:
        result = await db.execute(
            select(Tag).where(Tag.user_id == user_id).order_by(Tag.label.asc())
        )
        return list(result.scalars())

    async def slug_exists(self, db: AsyncSession, user_id: str, slug: str) -> bool:
        result = await db.execute(
            select(Tag.id).where(Tag.user_id == user_id, Tag.slug == slug).limit(1)
        )
        return result.scalar_one_or_none() is not None

    async def delete_by_id(self, db: AsyncSession, tag_id: int) -> None:
        await db.execute(delete(Tag).where(Tag.id == tag_id))
