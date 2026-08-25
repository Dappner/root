"""YouTube transcript client.

Wraps `youtube-transcript-api` so callers never import it directly. Owns the
WebshareProxy configuration and the optional-dependency import fallback.
Returns raw transcript entries (`[{"text", "start", "duration"}, ...]`) or
`None` if captions are unavailable. Formatting/cleaning is left to callers.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any

logger = logging.getLogger(__name__)


class YouTubeTranscriptClient:
    """Fetches YouTube caption transcripts with optional proxy support."""

    def __init__(
        self,
        *,
        proxy_username: str = "",
        proxy_password: str = "",
        proxy_country: str = "",
    ) -> None:
        self._proxy_username = proxy_username
        self._proxy_password = proxy_password
        self._proxy_country = proxy_country

    async def fetch_transcript(self, youtube_video_id: str) -> list[dict[str, Any]] | None:
        """Fetch transcript entries for a YouTube video.

        Returns the raw `[{"text", "start", "duration"}, ...]` list when
        captions exist, or `None` when captions are unavailable, disabled,
        the video is unreachable, or the optional dependency is missing.
        """
        try:
            from youtube_transcript_api import YouTubeTranscriptApi
            from youtube_transcript_api._errors import (
                NoTranscriptFound,
                TranscriptsDisabled,
                VideoUnavailable,
            )
            from youtube_transcript_api.proxies import WebshareProxyConfig
        except ImportError as ie:
            logger.warning("youtube-transcript-api not installed: %s", ie)
            return None

        proxy_config = None
        if self._proxy_username and self._proxy_password:
            logger.info("Using WebshareProxyConfig for YouTube transcript fetching")
            proxy_kwargs: dict[str, str] = {
                "proxy_username": self._proxy_username,
                "proxy_password": self._proxy_password,
            }
            if self._proxy_country:
                proxy_kwargs["proxy_country"] = self._proxy_country
            proxy_config = WebshareProxyConfig(**proxy_kwargs)  # type: ignore[arg-type]
        else:
            logger.info("No proxy configured for YouTube transcript fetching")

        def _fetch() -> list[dict[str, Any]]:
            ytt_api = YouTubeTranscriptApi(proxy_config=proxy_config)
            fetched = ytt_api.fetch(youtube_video_id)
            logger.info(
                "Got transcript in %s (%s), generated=%s, %d snippets",
                fetched.language,
                fetched.language_code,
                fetched.is_generated,
                len(fetched),
            )
            return fetched.to_raw_data()

        try:
            logger.info("Fetching YouTube captions for video %s", youtube_video_id)
            entries = await asyncio.to_thread(_fetch)
            logger.info("Got %d transcript entries", len(entries))
            return entries
        except (NoTranscriptFound, TranscriptsDisabled, VideoUnavailable) as e:
            logger.info(
                "YouTube captions not available for %s: %s: %s",
                youtube_video_id,
                type(e).__name__,
                e,
            )
            return None
        except Exception as e:
            logger.warning(
                "Error fetching YouTube captions for %s: %s: %s",
                youtube_video_id,
                type(e).__name__,
                e,
                exc_info=True,
            )
            return None
