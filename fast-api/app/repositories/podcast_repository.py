"""Queries and writes over `shows` and `podcast_episodes`."""

from __future__ import annotations

from typing import Any

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.datetime_utils import to_naive_utc, utcnow
from app.models.database import PodcastEpisode, Show


class PodcastRepository:
    # ---------- shows ----------

    async def list_shows(self, db: AsyncSession, *, limit: int, offset: int) -> list[Show]:
        stmt = select(Show).order_by(Show.updated_at.desc()).limit(limit).offset(offset)
        return list((await db.execute(stmt)).scalars().all())

    async def count_shows(self, db: AsyncSession) -> int:
        return int((await db.execute(select(func.count(Show.id)))).scalar_one())

    async def get_show_by_slug(self, db: AsyncSession, *, slug: str) -> Show | None:
        result = await db.execute(select(Show).where(Show.slug == slug))
        return result.scalar_one_or_none()

    async def upsert_show(self, db: AsyncSession, *, payload: dict[str, Any]) -> Show:
        """Insert or update a show row by slug, returning the persisted row."""
        now = utcnow()
        payload = {**payload, "updated_at": now}
        payload.setdefault("created_at", now)
        payload.setdefault("metadata_json", {})
        if "last_synced_at" in payload:
            payload["last_synced_at"] = to_naive_utc(payload["last_synced_at"])

        insert_stmt = pg_insert(Show).values(**payload)
        upsert_stmt = insert_stmt.on_conflict_do_update(
            index_elements=[Show.rss_feed_url],
            set_={
                "title": insert_stmt.excluded.title,
                "description": insert_stmt.excluded.description,
                "image_url": insert_stmt.excluded.image_url,
                "language": insert_stmt.excluded.language,
                "explicit": insert_stmt.excluded.explicit,
                "categories": insert_stmt.excluded.categories,
                "author": insert_stmt.excluded.author,
                "link": insert_stmt.excluded.link,
                "last_synced_at": insert_stmt.excluded.last_synced_at,
                "updated_at": insert_stmt.excluded.updated_at,
            },
        ).returning(Show)

        result = await db.execute(upsert_stmt)
        show: Show = result.scalar_one()
        return show

    # ---------- episodes ----------

    async def list_episodes_by_show(
        self, db: AsyncSession, *, show_id: int, limit: int, offset: int
    ) -> list[PodcastEpisode]:
        stmt = (
            select(PodcastEpisode)
            .where(PodcastEpisode.show_id == show_id)
            .order_by(
                PodcastEpisode.published_at.desc().nulls_last(),
                PodcastEpisode.id.desc(),
            )
            .limit(limit)
            .offset(offset)
        )
        return list((await db.execute(stmt)).scalars().all())

    async def count_episodes_by_show(self, db: AsyncSession, *, show_id: int) -> int:
        stmt = select(func.count(PodcastEpisode.id)).where(PodcastEpisode.show_id == show_id)
        return int((await db.execute(stmt)).scalar_one())

    async def existing_episode_guids(self, db: AsyncSession, *, show_id: int) -> set[str]:
        stmt = select(PodcastEpisode.episode_guid).where(PodcastEpisode.show_id == show_id)
        result = await db.execute(stmt)
        return {row[0] for row in result.all()}

    async def insert_new_episodes(self, db: AsyncSession, *, rows: list[dict[str, Any]]) -> int:
        """Insert episode rows, skipping ones whose (show_id, episode_guid) already exists."""
        if not rows:
            return 0
        now = utcnow()
        prepared = [
            {
                **row,
                "metadata_json": row.get("metadata_json", {}),
                "published_at": to_naive_utc(row.get("published_at")),
                "created_at": now,
                "updated_at": now,
            }
            for row in rows
        ]
        insert_stmt = pg_insert(PodcastEpisode).values(prepared)
        upsert_stmt = insert_stmt.on_conflict_do_nothing(
            index_elements=[PodcastEpisode.show_id, PodcastEpisode.episode_guid]
        )
        result = await db.execute(upsert_stmt)
        rowcount = getattr(result, "rowcount", None)
        return int(rowcount) if rowcount is not None else 0
