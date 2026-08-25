"""YouTube Data API v3 client.

Fetches video and channel metadata via the Data API (videos / channels
endpoints) and provides the helpers used by video import — ISO-8601 duration
parsing and video-ID extraction from the various YouTube URL forms.

All API/network failures surface as `ExternalServiceError` ("youtube", ...).
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import datetime

import httpx

from app.core.datetime_utils import to_naive_utc
from app.core.exceptions import ExternalServiceError

_BASE_URL = "https://www.googleapis.com/youtube/v3"
_TIMEOUT_SECONDS = 30.0
_MAX_BODY_BYTES = 1 << 20  # 1 MiB read cap


@dataclass
class VideoResult:
    """Normalized video metadata."""

    id: str
    title: str
    description: str
    channel_id: str
    channel_title: str
    thumbnail_url: str
    duration: int  # seconds
    view_count: int
    published_at: datetime | None


@dataclass
class ChannelResult:
    """Normalized channel metadata."""

    id: str
    title: str
    description: str
    thumbnail_url: str
    custom_url: str
    subscriber_count: int
    video_count: int


# Video ID extraction patterns.
_BARE_ID_RE = re.compile(r"^[a-zA-Z0-9_-]{11}$")
_WATCH_URL_RE = re.compile(
    r"(?:youtube\.com/watch\?.*v=|youtube\.com/watch\?v=)([a-zA-Z0-9_-]{11})"
)
_SHORT_URL_RE = re.compile(r"youtu\.be/([a-zA-Z0-9_-]{11})")
_EMBED_URL_RE = re.compile(r"youtube\.com/embed/([a-zA-Z0-9_-]{11})")
_SHORTS_URL_RE = re.compile(r"youtube\.com/shorts/([a-zA-Z0-9_-]{11})")

_DURATION_RE = re.compile(r"^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$")


def extract_video_id(input_str: str) -> str:
    """Extract the 11-char YouTube video ID from a URL or bare ID.

    Accepts a bare ID, watch URLs (`watch?v=`), short URLs (`youtu.be/`),
    embed URLs (`embed/`), and shorts URLs (`shorts/`). Raises
    `ExternalServiceError` when no ID can be extracted.
    """
    value = input_str.strip()

    if _BARE_ID_RE.match(value):
        return value

    for pattern in (_WATCH_URL_RE, _SHORT_URL_RE, _EMBED_URL_RE, _SHORTS_URL_RE):
        match = pattern.search(value)
        if match:
            return match.group(1)

    raise ExternalServiceError("youtube", f"could not extract video ID from: {input_str}")


def parse_iso8601_duration(duration: str) -> int:
    """Convert an ISO-8601 duration (e.g. ``PT1H2M10S``) to whole seconds.

    Tolerant of missing components and a leading day part; returns 0 for
    empty/unparseable input rather than raising.
    """
    if not duration:
        return 0

    match = _DURATION_RE.match(duration)
    if not match:
        return 0

    days = int(match.group(1) or 0)
    hours = int(match.group(2) or 0)
    minutes = int(match.group(3) or 0)
    seconds = int(match.group(4) or 0)
    return days * 86400 + hours * 3600 + minutes * 60 + seconds


def _best_thumbnail(thumbnails: dict) -> str:
    for size in ("high", "medium", "default"):
        url = (thumbnails.get(size) or {}).get("url")
        if url:
            return str(url)
    return ""


def _parse_int(value: str | None) -> int:
    if not value:
        return 0
    try:
        return int(value)
    except (ValueError, TypeError):
        return 0


def _parse_published_at(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        # YouTube returns RFC-3339 with a trailing Z; `fromisoformat` handles
        # the offset form, so swap Z for +00:00.
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    return to_naive_utc(parsed)


class YouTubeDataClient:
    """YouTube Data API v3 client (httpx)."""

    def __init__(self, api_key: str) -> None:
        self._api_key = api_key

    async def _get(self, path: str, params: dict[str, str]) -> dict:
        params = {**params, "key": self._api_key}
        try:
            async with httpx.AsyncClient(timeout=_TIMEOUT_SECONDS) as client:
                resp = await client.get(f"{_BASE_URL}/{path}", params=params)
        except httpx.HTTPError as exc:
            raise ExternalServiceError("youtube", f"request failed: {exc}") from exc

        if resp.status_code != httpx.codes.OK:
            body = resp.text[:1024]
            raise ExternalServiceError("youtube", f"API error: {resp.status_code} - {body}")

        # Guard against unexpectedly large bodies (1MB cap).
        if len(resp.content) > _MAX_BODY_BYTES:
            raise ExternalServiceError("youtube", "response too large")

        try:
            data: dict = resp.json()
        except ValueError as exc:
            raise ExternalServiceError("youtube", f"decode response: {exc}") from exc
        return data

    async def get_video(self, video_id: str) -> VideoResult:
        """Fetch video metadata. Raises `ExternalServiceError` when not found."""
        payload = await self._get(
            "videos",
            {"part": "snippet,contentDetails,statistics", "id": video_id},
        )
        items = payload.get("items") or []
        if not items:
            raise ExternalServiceError("youtube", f"video not found: {video_id}")

        item = items[0]
        snippet = item.get("snippet") or {}
        content_details = item.get("contentDetails") or {}
        statistics = item.get("statistics") or {}

        return VideoResult(
            id=item.get("id", ""),
            title=snippet.get("title", ""),
            description=snippet.get("description", ""),
            channel_id=snippet.get("channelId", ""),
            channel_title=snippet.get("channelTitle", ""),
            thumbnail_url=_best_thumbnail(snippet.get("thumbnails") or {}),
            duration=parse_iso8601_duration(content_details.get("duration", "")),
            view_count=_parse_int(statistics.get("viewCount")),
            published_at=_parse_published_at(snippet.get("publishedAt")),
        )

    async def get_channel(self, channel_id: str) -> ChannelResult:
        """Fetch channel metadata. Raises `ExternalServiceError` when not found."""
        payload = await self._get(
            "channels",
            {"part": "snippet,statistics", "id": channel_id},
        )
        items = payload.get("items") or []
        if not items:
            raise ExternalServiceError("youtube", f"channel not found: {channel_id}")

        item = items[0]
        snippet = item.get("snippet") or {}
        statistics = item.get("statistics") or {}

        return ChannelResult(
            id=item.get("id", ""),
            title=snippet.get("title", ""),
            description=snippet.get("description", ""),
            thumbnail_url=_best_thumbnail(snippet.get("thumbnails") or {}),
            custom_url=snippet.get("customUrl", ""),
            subscriber_count=_parse_int(statistics.get("subscriberCount")),
            video_count=_parse_int(statistics.get("videoCount")),
        )
