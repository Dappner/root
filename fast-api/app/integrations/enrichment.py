"""Lightweight source enrichment from a URL.

Fetch normalized metadata (title / site name / author / description) via YouTube
oEmbed for YouTube URLs, or OpenGraph/twitter/<title> scraping for everything
else, using the stdlib `html.parser`.

All failures surface as `ExternalServiceError` ("enrichment", ...), mapped to
HTTP 503.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from html.parser import HTMLParser
from urllib.parse import quote

import httpx

from app.core.exceptions import ExternalServiceError

_DEFAULT_USER_AGENT = (
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)
_TIMEOUT_SECONDS = 15.0
_MAX_BODY_BYTES = 2 << 20  # 2 MiB read cap
_YOUTUBE_RE = re.compile(r"(?:youtube\.com/watch\?v=|youtu\.be/)([a-zA-Z0-9_-]{11})")


@dataclass
class EnrichmentMetadata:
    """Normalized enrichment result (OG/oEmbed flows)."""

    title: str = ""
    site_name: str = ""
    author_name: str = ""
    description: str = ""


def is_youtube_url(url: str) -> bool:
    return _YOUTUBE_RE.search(url) is not None


class _OpenGraphParser(HTMLParser):
    """Single-pass collector for OpenGraph/twitter meta tags and <title>.

    Stores the first non-empty value seen for each key (document order).
    """

    def __init__(self) -> None:
        super().__init__()
        self.meta: dict[str, str] = {}
        self._title_parts: list[str] = []
        self._in_title = False
        self.title: str = ""

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag == "title":
            self._in_title = True
            return
        if tag != "meta":
            return
        attr = {k.lower(): (v or "") for k, v in attrs}
        key = attr.get("property") or attr.get("name")
        content = attr.get("content", "").strip()
        if not key or not content:
            return
        key = key.lower()
        # First non-empty wins (document order).
        self.meta.setdefault(key, content)

    def handle_endtag(self, tag: str) -> None:
        if tag == "title":
            self._in_title = False
            if not self.title:
                self.title = "".join(self._title_parts).strip()

    def handle_data(self, data: str) -> None:
        if self._in_title and not self.title:
            self._title_parts.append(data)


def _first_non_empty(*values: str) -> str:
    for value in values:
        if value:
            return value
    return ""


def parse_opengraph(html_text: str) -> EnrichmentMetadata:
    """Extract enrichment metadata from an HTML document (pure, no network).

    Prefers og:title, then twitter:title, then <title>; og:description then
    name=description. Trims a trailing " - Medium" suffix from the title.
    """
    parser = _OpenGraphParser()
    parser.feed(html_text)
    parser.close()

    title = _first_non_empty(
        parser.meta.get("og:title", "").strip(),
        parser.meta.get("twitter:title", "").strip(),
        parser.title.strip(),
    )
    description = _first_non_empty(
        parser.meta.get("og:description", "").strip(),
        parser.meta.get("description", "").strip(),
    )

    if title.endswith(" - Medium"):
        title = title[: -len(" - Medium")]

    return EnrichmentMetadata(
        title=title.strip(),
        site_name=parser.meta.get("og:site_name", "").strip(),
        description=description.strip(),
    )


async def _fetch_youtube_oembed(client: httpx.AsyncClient, video_url: str) -> EnrichmentMetadata:
    endpoint = f"https://www.youtube.com/oembed?url={quote(video_url, safe='')}&format=json"
    try:
        response = await client.get(endpoint, headers={"User-Agent": _DEFAULT_USER_AGENT})
    except httpx.HTTPError as exc:
        raise ExternalServiceError("enrichment", f"oembed request failed: {exc}") from exc

    if response.status_code != 200:
        snippet = response.text[:512].strip()
        raise ExternalServiceError(
            "enrichment", f"oembed returned status {response.status_code}: {snippet}"
        )

    try:
        payload = json.loads(response.text)
    except json.JSONDecodeError as exc:
        raise ExternalServiceError("enrichment", f"decode oembed response: {exc}") from exc

    return EnrichmentMetadata(
        title=str(payload.get("title", "")).strip(),
        author_name=str(payload.get("author_name", "")).strip(),
        site_name=str(payload.get("provider_name", "")).strip(),
    )


async def _fetch_opengraph(client: httpx.AsyncClient, url: str) -> EnrichmentMetadata:
    try:
        response = await client.get(
            url,
            headers={
                "User-Agent": _DEFAULT_USER_AGENT,
                "Accept-Language": "en-US,en;q=0.9",
            },
        )
    except httpx.HTTPError as exc:
        raise ExternalServiceError("enrichment", f"request failed: {exc}") from exc

    if response.status_code != 200:
        snippet = response.text[:512].strip()
        raise ExternalServiceError("enrichment", f"status {response.status_code}: {snippet}")

    body = response.content[:_MAX_BODY_BYTES]
    encoding = response.encoding or "utf-8"
    try:
        html_text = body.decode(encoding, errors="replace")
    except LookupError:
        html_text = body.decode("utf-8", errors="replace")

    metadata = parse_opengraph(html_text)

    if not metadata.title and not metadata.site_name and not metadata.description:
        raise ExternalServiceError("enrichment", "no metadata found via OpenGraph")

    return metadata


async def fetch_metadata_from_web(url: str) -> EnrichmentMetadata:
    """Fetch normalized metadata for a URL via oEmbed (YouTube) or OpenGraph.

    Raises `ExternalServiceError` on an empty URL, a non-200 response, or a
    network/parse failure.
    """
    trimmed = url.strip()
    if not trimmed:
        raise ExternalServiceError("enrichment", "url is empty")

    async with httpx.AsyncClient(timeout=_TIMEOUT_SECONDS, follow_redirects=True) as client:
        if is_youtube_url(trimmed):
            return await _fetch_youtube_oembed(client, trimmed)
        return await _fetch_opengraph(client, trimmed)
