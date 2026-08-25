"""Podcast RSS sync: fetch feed, upsert show, insert new episodes."""

from __future__ import annotations

import re
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from typing import Any
from xml.etree.ElementTree import Element

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.core.database import AsyncSessionLocal
from app.core.datetime_utils import utcnow
from app.core.logging import get_logger
from app.integrations.apple_podcasts import ApplePodcastsClient
from app.integrations.rss import fetch_channel
from app.models.database import Show
from app.repositories.podcast_repository import PodcastRepository

logger = get_logger(__name__)

_ITUNES_NS = "http://www.itunes.com/dtds/podcast-1.0.dtd"
_CONTENT_NS = "http://purl.org/rss/1.0/modules/content/"
_NSMAP = {"itunes": _ITUNES_NS, "content": _CONTENT_NS}

_SLUG_NORMALIZE = re.compile(r"[^a-z0-9]+")


def _normalize_slug(value: str) -> str:
    """Lowercase, strip currency/punctuation, collapse non-alphanumerics to
    '-', trim leading/trailing dashes."""
    value = value.lower()
    for ch in ("$", "€", "£", ".", ","):
        value = value.replace(ch, "")
    value = _SLUG_NORMALIZE.sub("-", value)
    return value.strip("-")


def _parse_itunes_duration(raw: str | None) -> int | None:
    """HH:MM:SS / MM:SS / seconds → int seconds. None on failure or empty."""
    if not raw:
        return None
    raw = raw.strip()
    if not raw:
        return None
    if raw.isdigit():
        return int(raw)
    parts = raw.split(":")
    if len(parts) not in (2, 3):
        return None
    try:
        nums = [int(p) for p in parts]
    except ValueError:
        return None
    if len(nums) == 3:
        h, m, s = nums
    else:
        h, (m, s) = 0, nums
    return h * 3600 + m * 60 + s


def _parse_pub_date(raw: str | None) -> datetime | None:
    if not raw or not raw.strip():
        return None
    try:
        dt = parsedate_to_datetime(raw)
    except (TypeError, ValueError):
        return None
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


def _text(elem: Element | None, path: str) -> str:
    if elem is None:
        return ""
    found = elem.find(path, _NSMAP)
    return (found.text or "").strip() if found is not None and found.text else ""


def _attr(elem: Element | None, path: str, attr: str) -> str:
    if elem is None:
        return ""
    found = elem.find(path, _NSMAP)
    return found.get(attr, "") if found is not None else ""


def _categories(channel: Element) -> list[str]:
    cats: list[str] = []
    for cat in channel.findall("itunes:category", _NSMAP):
        text = cat.get("text", "").strip()
        if text:
            cats.append(text)
        for child in cat.findall("itunes:category", _NSMAP):
            child_text = child.get("text", "").strip()
            if child_text:
                cats.append(child_text)
    return cats


def _show_payload(rss_feed_url: str, slug: str, channel: Element) -> dict[str, Any]:
    title = _text(channel, "title")
    if not slug:
        slug = _normalize_slug(title) or _normalize_slug(rss_feed_url)

    image_url = _attr(channel, "itunes:image", "href") or _text(channel, "image/url")
    explicit_raw = _text(channel, "itunes:explicit").lower()

    return {
        "slug": slug,
        "rss_feed_url": rss_feed_url,
        "title": title.strip(),
        "description": _text(channel, "description") or None,
        "image_url": image_url or None,
        "language": _text(channel, "language") or None,
        "explicit": explicit_raw in ("yes", "true") if explicit_raw else None,
        "author": _text(channel, "itunes:author") or None,
        "link": _text(channel, "link") or None,
        "categories": _categories(channel) or None,
        "last_synced_at": utcnow(),
    }


def _episode_payload(show_id: int, item: Element) -> dict[str, Any] | None:
    guid = _text(item, "guid")
    if not guid:
        return None

    title = _text(item, "itunes:title") or _text(item, "title")
    description = _text(item, "description") or _text(item, "content:encoded") or None
    enclosure_url = _attr(item, "enclosure", "url") or None
    image_url = _attr(item, "itunes:image", "href") or None
    duration = _parse_itunes_duration(_text(item, "itunes:duration"))
    published_at = _parse_pub_date(_text(item, "pubDate"))

    season = _text(item, "itunes:season")
    episode_number = _text(item, "itunes:episode")

    return {
        "show_id": show_id,
        "episode_guid": guid,
        "title": title,
        "description": description,
        "season": int(season) if season.isdigit() else None,
        "episode_number": int(episode_number) if episode_number.isdigit() else None,
        "duration": duration,
        "enclosure_url": enclosure_url,
        "image_url": image_url,
        "published_at": published_at,
    }


class PodcastSyncService:
    def __init__(
        self,
        session_factory: async_sessionmaker[AsyncSession] = AsyncSessionLocal,
        apple_client: ApplePodcastsClient | None = None,
    ) -> None:
        self.session_factory = session_factory
        self.apple_client = apple_client or ApplePodcastsClient()

    async def sync_show(self, *, rss_feed_url: str, slug: str) -> None:
        """Background-safe sync. Swallows errors and logs."""
        try:
            await self._sync(rss_feed_url=rss_feed_url, slug=slug)
        except Exception as exc:
            logger.warning("Show sync failed slug=%s: %s", slug, exc, exc_info=True)

    async def import_apple(self, *, apple_url: str) -> Show:
        """Foreground import: resolve Apple URL → RSS feed → sync show. Returns the
        persisted Show. Raises on failure so the HTTP caller can respond."""
        lookup = await self.apple_client.lookup_show_by_url(apple_url)
        return await self._sync(rss_feed_url=lookup.feed_url, slug=lookup.slug)

    async def _sync(self, *, rss_feed_url: str, slug: str) -> Show:
        """Fetch RSS, upsert show, insert any new episodes. Returns the show."""
        channel = await fetch_channel(rss_feed_url)
        repo = PodcastRepository()
        async with self.session_factory() as db:
            show = await repo.upsert_show(db, payload=_show_payload(rss_feed_url, slug, channel))
            await db.flush()

            existing_guids = await repo.existing_episode_guids(db, show_id=show.id)

            items = channel.findall("item")
            new_rows: list[dict[str, Any]] = []
            for item in items:
                payload = _episode_payload(show.id, item)
                if payload is None:
                    continue
                if payload["episode_guid"] in existing_guids:
                    continue
                new_rows.append(payload)

            inserted = 0
            if new_rows:
                inserted = await repo.insert_new_episodes(db, rows=new_rows)

            await db.commit()
            logger.info(
                "synced show slug=%s total_items=%d new=%d",
                show.slug,
                len(items),
                inserted,
            )
            return show
