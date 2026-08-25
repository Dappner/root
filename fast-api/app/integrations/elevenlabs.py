"""ElevenLabs conversational-voice client.

Wraps the ElevenLabs ConvAI HTTP API so callers never issue raw `httpx`
requests. Returns plain strings (signed URL / token); signals failure via
`ElevenLabsError`, which carries enough context for the route to preserve its
existing error responses.

Note: this client deliberately does NOT raise the app's domain
`ExternalServiceError`. The voice routes have a bespoke error contract the
mobile client depends on (see TODO.md — "Standardize the voice endpoints'
error contract"); the route maps `ElevenLabsError` to that contract verbatim.
"""

from __future__ import annotations

import httpx

from app.core.logging import get_logger

logger = get_logger(__name__)

_SIGNED_URL = "https://api.elevenlabs.io/v1/convai/conversation/get-signed-url"
_CONVERSATION_TOKEN = "https://api.elevenlabs.io/v1/convai/conversation/token"


class ElevenLabsNotConfiguredError(Exception):
    """Raised when an API key or agent id is missing."""

    def __init__(self, detail: str) -> None:
        super().__init__(detail)
        self.detail = detail


class ElevenLabsError(Exception):
    """Raised on transport failure or a non-2xx upstream response.

    `upstream_status` / `upstream_body` are populated for non-2xx responses and
    left as None for transport-level (httpx) failures.
    """

    def __init__(
        self,
        message: str,
        *,
        upstream_status: int | None = None,
        upstream_body: str | None = None,
    ) -> None:
        super().__init__(message)
        self.message = message
        self.upstream_status = upstream_status
        self.upstream_body = upstream_body


class ElevenLabsClient:
    """HTTP client for ElevenLabs conversational-voice setup."""

    def __init__(self, *, api_key: str, agent_id: str, timeout: float = 30.0) -> None:
        self._api_key = api_key.strip()
        self._agent_id = agent_id.strip()
        self._timeout = timeout

    @property
    def is_configured(self) -> bool:
        return bool(self._api_key) and bool(self._agent_id)

    def _require_configured(self) -> None:
        if not self._api_key:
            raise ElevenLabsNotConfiguredError("ElevenLabs API key is not configured")
        if not self._agent_id:
            raise ElevenLabsNotConfiguredError("ElevenLabs agent ID is not configured")

    async def _fetch_field(self, url: str, *, field: str, label: str) -> str:
        """GET `url` for the configured agent and return `body[field]`.

        `label` is the human phrase used in failure messages (e.g.
        "signed URL setup"). Raises `ElevenLabsError` on any failure.
        """
        self._require_configured()
        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                response = await client.get(
                    url,
                    params={"agent_id": self._agent_id},
                    headers={"xi-api-key": self._api_key},
                )
        except httpx.HTTPError as exc:
            logger.exception("ElevenLabs %s transport failure", label)
            raise ElevenLabsError(f"ElevenLabs {label} failed") from exc

        if response.status_code >= 400:
            logger.warning(
                "ElevenLabs %s failed: status=%s body=%s",
                label,
                response.status_code,
                response.text[:500],
            )
            raise ElevenLabsError(
                f"ElevenLabs {label} failed",
                upstream_status=response.status_code,
                upstream_body=response.text[:1000],
            )

        value = response.json().get(field)
        if not isinstance(value, str) or not value:
            raise ElevenLabsError(f"ElevenLabs response missing {field}")
        return value

    async def create_signed_url(self) -> str:
        return await self._fetch_field(_SIGNED_URL, field="signed_url", label="signed URL setup")

    async def create_conversation_token(self) -> str:
        return await self._fetch_field(
            _CONVERSATION_TOKEN, field="token", label="conversation token setup"
        )
