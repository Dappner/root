"""Apple Podcasts lookup client.

Resolves an Apple Podcasts URL (or numeric ID) to an RSS feed URL and a slug,
via the public iTunes Lookup API. The full URL → (feed_url, slug) flow lives
here so callers never touch URL parsing or the iTunes API directly.
"""

from __future__ import annotations

import re
from urllib.parse import urlparse

import httpx

from app.core.exceptions import ExternalServiceError, ValidationError

_LOOKUP_ENDPOINT = "https://itunes.apple.com/lookup"
_MAX_RESPONSE_BYTES = 1 << 20  # 1 MiB
_HTTP_TIMEOUT = 10.0
_APPLE_ID_RE = re.compile(r"id(\d+)")
_ID_SEGMENT_RE = re.compile(r"^id\d+$")


class AppleShowLookup:
    __slots__ = ("feed_url", "slug")

    def __init__(self, feed_url: str, slug: str) -> None:
        self.feed_url = feed_url
        self.slug = slug


class ApplePodcastsClient:
    """Thin client over iTunes Lookup API for podcast show metadata."""

    async def lookup_show_by_url(self, apple_url: str) -> AppleShowLookup:
        """Resolve an Apple Podcasts URL → (feed_url, slug).

        Slug is taken from the URL's path when available, falling back to the
        path of the iTunes `trackViewUrl`. Raises ValidationError if the URL
        does not contain an Apple show ID, ExternalServiceError on API failure.
        """
        match = _APPLE_ID_RE.search(apple_url)
        if not match:
            raise ValidationError("Could not extract Apple podcast id from URL")
        show_id = match.group(1)

        feed_url, track_view_url = await self._lookup_show(show_id)

        slug = extract_slug_from_url(apple_url) or extract_slug_from_url(track_view_url)
        return AppleShowLookup(feed_url=feed_url, slug=slug)

    async def _lookup_show(self, show_id: str) -> tuple[str, str]:
        params = {"id": show_id, "entity": "podcast"}
        try:
            async with httpx.AsyncClient(timeout=_HTTP_TIMEOUT) as client:
                response = await client.get(_LOOKUP_ENDPOINT, params=params)
                response.raise_for_status()
                if len(response.content) > _MAX_RESPONSE_BYTES:
                    raise ExternalServiceError(
                        "apple_podcasts", "lookup response exceeded size limit"
                    )
                payload = response.json()
        except httpx.HTTPError as exc:
            raise ExternalServiceError("apple_podcasts", f"lookup failed: {exc}") from exc

        results = payload.get("results") or []
        if not results:
            raise ExternalServiceError("apple_podcasts", "no results for show id")

        first = results[0]
        feed_url = (first.get("feedUrl") or "").strip()
        if not feed_url:
            raise ExternalServiceError("apple_podcasts", "no feed url returned for podcast")
        return feed_url, (first.get("trackViewUrl") or "")


def extract_slug_from_url(apple_url: str) -> str:
    """Pull the show slug (segment before the `idNNN…` segment) from an Apple URL.

    Only matches segments that are exactly `id` followed by digits, so a podcast
    slug like `ideas` or `id10t` is not mistaken for the id segment.
    """
    if not apple_url:
        return ""
    parsed = urlparse(apple_url)
    segments = [seg for seg in parsed.path.split("/") if seg]
    for i, seg in enumerate(segments):
        if _ID_SEGMENT_RE.match(seg):
            return segments[i - 1] if i > 0 else ""
    return ""
