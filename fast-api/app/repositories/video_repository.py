"""Queries over `channels` and `videos`, including import upserts."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import cast, func, select
from sqlalchemy.dialects.postgresql import ENUM
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql import func as sql_func

from app.core.datetime_utils import to_naive_utc, utcnow
from app.models.database import Channel, Video

# `channels.platform` / `videos.platform` are the PG enum `channel_platform`,
# but the ORM maps them as plain strings. Comparing/inserting a bound varchar
# fails ("operator does not exist: channel_platform = character varying"), so
# cast the python value to the enum type explicitly.
_CHANNEL_PLATFORM = ENUM(name="channel_platform", create_type=False)


def _platform(value: str) -> object:
    return cast(value, _CHANNEL_PLATFORM)


class VideoRepository:
    # ---------- channels ----------

    async def list_channels(self, db: AsyncSession, *, limit: int, offset: int) -> list[Channel]:
        stmt = select(Channel).order_by(Channel.updated_at.desc()).limit(limit).offset(offset)
        return list((await db.execute(stmt)).scalars().all())

    async def count_channels(self, db: AsyncSession) -> int:
        return int((await db.execute(select(func.count(Channel.id)))).scalar_one())

    async def get_channel(self, db: AsyncSession, *, channel_id: int) -> Channel | None:
        result = await db.execute(select(Channel).where(Channel.id == channel_id))
        return result.scalar_one_or_none()

    async def get_channel_by_platform_id(
        self, db: AsyncSession, *, platform: str, platform_id: str
    ) -> Channel | None:
        result = await db.execute(
            select(Channel).where(
                Channel.platform == _platform(platform),
                Channel.platform_id == platform_id,
            )
        )
        return result.scalar_one_or_none()

    async def upsert_channel(
        self,
        db: AsyncSession,
        *,
        platform: str,
        platform_id: str,
        name: str,
        description: str | None = None,
        thumbnail_url: str | None = None,
        subscriber_count: int | None = None,
        video_count: int | None = None,
        custom_url: str | None = None,
    ) -> Channel:
        """Insert or update a channel keyed on (platform, platform_id).

        Returns the persisted Channel (flushed, not committed)."""
        now = utcnow()
        stmt = (
            pg_insert(Channel)
            .values(
                platform=_platform(platform),
                platform_id=platform_id,
                name=name,
                description=description,
                thumbnail_url=thumbnail_url,
                subscriber_count=subscriber_count,
                video_count=video_count,
                custom_url=custom_url,
                metadata_json={},
                created_at=now,
                updated_at=now,
            )
            .on_conflict_do_update(
                index_elements=[Channel.platform, Channel.platform_id],
                set_={
                    "name": name,
                    "description": description,
                    "thumbnail_url": thumbnail_url,
                    "subscriber_count": subscriber_count,
                    "video_count": video_count,
                    "custom_url": custom_url,
                    "updated_at": now,
                },
            )
            .returning(Channel.id)
        )
        channel_id = int((await db.execute(stmt)).scalar_one())
        await db.flush()
        channel = await self.get_channel(db, channel_id=channel_id)
        assert channel is not None  # just upserted
        return channel

    # ---------- videos ----------

    async def get_video(self, db: AsyncSession, *, video_id: int) -> Video | None:
        result = await db.execute(select(Video).where(Video.id == video_id))
        return result.scalar_one_or_none()

    async def get_video_by_platform_id(
        self, db: AsyncSession, *, platform: str, platform_id: str
    ) -> Video | None:
        result = await db.execute(
            select(Video).where(
                Video.platform == _platform(platform),
                Video.platform_id == platform_id,
            )
        )
        return result.scalar_one_or_none()

    async def upsert_video(
        self,
        db: AsyncSession,
        *,
        platform: str,
        platform_id: str,
        title: str,
        channel_id: int | None = None,
        description: str | None = None,
        thumbnail_url: str | None = None,
        duration: int | None = None,
        view_count: int | None = None,
        embed_url: str | None = None,
        transcript_status: str = "none",
        published_at: datetime | None = None,
    ) -> Video:
        """Insert or update a video keyed on (platform, platform_id).

        Returns the persisted Video (flushed, not committed). `transcript_status`
        is only set on insert so re-importing never clobbers an
        in-progress/finished transcript."""
        now = utcnow()
        insert_stmt = pg_insert(Video).values(
            platform=_platform(platform),
            platform_id=platform_id,
            title=title,
            channel_id=channel_id,
            description=description,
            thumbnail_url=thumbnail_url,
            duration=duration,
            view_count=view_count,
            embed_url=embed_url,
            transcript_status=transcript_status,
            published_at=to_naive_utc(published_at),
            metadata_json={},
            created_at=now,
            updated_at=now,
        )
        upsert_stmt = insert_stmt.on_conflict_do_update(
            index_elements=[Video.platform, Video.platform_id],
            set_={
                "title": title,
                # COALESCE(EXCLUDED.channel_id, videos.channel_id): keep an
                # existing channel link if the re-import lacks one.
                "channel_id": sql_func.coalesce(insert_stmt.excluded.channel_id, Video.channel_id),
                "description": description,
                "thumbnail_url": thumbnail_url,
                "duration": duration,
                "view_count": view_count,
                "embed_url": embed_url,
                "published_at": to_naive_utc(published_at),
                "updated_at": now,
            },
        ).returning(Video.id)
        video_id = int((await db.execute(upsert_stmt)).scalar_one())
        await db.flush()
        video = await self.get_video(db, video_id=video_id)
        assert video is not None  # just upserted
        return video

    async def list_videos_by_channel(
        self, db: AsyncSession, *, channel_id: int, limit: int, offset: int
    ) -> list[Video]:
        stmt = (
            select(Video)
            .where(Video.channel_id == channel_id)
            .order_by(
                Video.published_at.desc().nulls_last(),
                Video.id.desc(),
            )
            .limit(limit)
            .offset(offset)
        )
        return list((await db.execute(stmt)).scalars().all())

    async def count_videos_by_channel(self, db: AsyncSession, *, channel_id: int) -> int:
        stmt = select(func.count(Video.id)).where(Video.channel_id == channel_id)
        return int((await db.execute(stmt)).scalar_one())
