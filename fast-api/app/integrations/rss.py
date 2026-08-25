"""RSS feed fetcher.

Owns the HTTP transport and XML safe-parsing for RSS feeds. Returns the
`<channel>` element so callers can extract domain fields with their own
vocabulary (namespace map lives in the caller, since the mapping from XML
fields to our schema is service logic, not provider logic).
"""

from __future__ import annotations

from typing import cast
from xml.etree.ElementTree import Element

import httpx
from defusedxml.ElementTree import fromstring as defused_fromstring

_MAX_RSS_BYTES = 50 * 1024 * 1024  # 50 MB
_HTTP_TIMEOUT = 20.0


async def fetch_channel(url: str) -> Element:
    """Fetch and parse an RSS feed; return its <channel> element.

    Raises:
        httpx.HTTPError: on transport/HTTP failure.
        ValueError: if the feed exceeds the size cap or lacks a <channel>.
    """
    async with httpx.AsyncClient(timeout=_HTTP_TIMEOUT, follow_redirects=True) as client:
        async with client.stream("GET", url) as response:
            response.raise_for_status()
            chunks: list[bytes] = []
            total = 0
            async for chunk in response.aiter_bytes():
                total += len(chunk)
                if total > _MAX_RSS_BYTES:
                    raise ValueError(
                        f"RSS feed exceeds maximum size limit of {_MAX_RSS_BYTES} bytes"
                    )
                chunks.append(chunk)
    body = b"".join(chunks)
    root = defused_fromstring(body)
    channel = root.find("channel")
    if channel is None:
        raise ValueError("RSS feed missing <channel> element")
    return cast(Element, channel)
