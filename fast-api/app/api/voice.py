"""Voice API endpoints.

Thin handlers over `ElevenLabsClient`. The HTTP call to ElevenLabs lives in the
integration client; these handlers only translate its outcomes into the route's
existing error contract (see TODO.md for the plan to standardize that contract).
"""

from typing import Annotated

from fastapi import Depends, HTTPException

from app.core.auth import get_current_user_id
from app.core.logging import get_logger
from app.core.routing import APIRouter
from app.deps import get_elevenlabs
from app.integrations.elevenlabs import (
    ElevenLabsClient,
    ElevenLabsError,
    ElevenLabsNotConfiguredError,
)

logger = get_logger(__name__)
router = APIRouter(prefix="/voice", tags=["voice"])


def _to_http_exception(exc: ElevenLabsError) -> HTTPException:
    """Map a client error to the route's existing 502 response shape.

    Transport failures keep the plain-string detail; non-2xx upstream responses
    keep the structured detail (message + upstream status/body) the mobile client
    has historically received.
    """
    if exc.upstream_status is not None:
        return HTTPException(
            status_code=502,
            detail={
                "message": exc.message,
                "elevenlabs_status": exc.upstream_status,
                "elevenlabs_body": exc.upstream_body,
            },
        )
    return HTTPException(status_code=502, detail=exc.message)


@router.post("/elevenlabs/signed-url")
async def create_elevenlabs_signed_url(
    user_id: Annotated[str, Depends(get_current_user_id)],
    client: Annotated[ElevenLabsClient, Depends(get_elevenlabs)],
) -> dict[str, str]:
    """Create a short-lived ElevenLabs signed URL for the configured agent."""
    logger.info("Creating ElevenLabs signed URL for user %s", user_id)
    try:
        signed_url = await client.create_signed_url()
    except ElevenLabsNotConfiguredError as exc:
        raise HTTPException(status_code=503, detail=exc.detail) from exc
    except ElevenLabsError as exc:
        raise _to_http_exception(exc) from exc

    return {"signed_url": signed_url}


@router.post("/elevenlabs/conversation-token")
async def create_elevenlabs_conversation_token(
    user_id: Annotated[str, Depends(get_current_user_id)],
    client: Annotated[ElevenLabsClient, Depends(get_elevenlabs)],
) -> dict[str, str]:
    """Create a short-lived ElevenLabs LiveKit token for the configured RN agent."""
    logger.info("Creating ElevenLabs conversation token for user %s", user_id)
    try:
        token = await client.create_conversation_token()
    except ElevenLabsNotConfiguredError as exc:
        raise HTTPException(status_code=503, detail=exc.detail) from exc
    except ElevenLabsError as exc:
        raise _to_http_exception(exc) from exc

    return {"token": token}
