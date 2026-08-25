from __future__ import annotations

import re

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.datetime_utils import utcnow
from app.core.exceptions import ConflictError, ValidationError
from app.core.ownership import require_tag
from app.models.database import Tag
from app.repositories.tag_repository import TagRepository

_SLUG_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
_SLUG_MAX_LEN = 64


def _validate_slug(slug: str) -> None:
    cleaned = slug.strip()
    if not cleaned or len(cleaned) > _SLUG_MAX_LEN or not _SLUG_RE.match(cleaned):
        raise ValidationError(
            "invalid slug: must be kebab-case (lowercase letters, numbers, hyphens)"
        )


class TagService:
    def __init__(self, repo: TagRepository | None = None) -> None:
        self._repo = repo or TagRepository()

    async def create(
        self,
        *,
        db: AsyncSession,
        user_id: str,
        slug: str,
        label: str,
        color: str | None,
    ) -> Tag:
        _validate_slug(slug)
        if await self._repo.slug_exists(db, user_id, slug):
            raise ConflictError(f"tag slug '{slug}' already exists")

        now = utcnow()
        tag = await self._repo.create(
            db,
            Tag(
                user_id=user_id,
                slug=slug,
                label=label,
                color=color,
                created_at=now,
                updated_at=now,
            ),
        )
        await db.flush()
        await db.refresh(tag)
        return tag

    async def get(self, *, db: AsyncSession, user_id: str, tag_id: int) -> Tag:
        return await require_tag(db, tag_id, user_id)

    async def list_for_user(self, *, db: AsyncSession, user_id: str) -> list[Tag]:
        return await self._repo.list_for_user(db, user_id)

    async def update(
        self,
        *,
        db: AsyncSession,
        user_id: str,
        tag_id: int,
        label: str,
        color: str | None,
    ) -> Tag:
        tag = await require_tag(db, tag_id, user_id)
        tag.label = label
        tag.color = color
        tag.updated_at = utcnow()
        await db.flush()
        await db.refresh(tag)
        return tag

    async def delete(self, *, db: AsyncSession, user_id: str, tag_id: int) -> None:
        tag = await require_tag(db, tag_id, user_id)
        await self._repo.delete_by_id(db, tag.id)
