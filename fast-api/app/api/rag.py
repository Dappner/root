"""RAG API endpoints."""

import asyncio
import uuid
from typing import Annotated

from fastapi import Depends, HTTPException, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sse_starlette.sse import EventSourceResponse

from app.core.auth import get_current_user_id
from app.core.database import get_db
from app.core.logging import get_logger
from app.core.routing import APIRouter
from app.core.streaming.ask_run_store import ask_run_store
from app.core.streaming.ask_runner import run_ask_in_background, stream_events, tail_run
from app.core.streaming.reflect_session_store import reflect_session_store
from app.deps import get_voyage
from app.integrations.voyage import VoyageClient
from app.schemas.model_catalog import MODEL_CATALOG, ModelCatalog
from app.schemas.rag import AskRequest, ReflectRequest
from app.services.rag_service import RAGService

logger = get_logger(__name__)
router = APIRouter(prefix="/ask", tags=["rag"])

MODEL_CATALOG_CACHE_CONTROL = "public, max-age=86400, stale-while-revalidate=604800"
MODEL_CATALOG_ETAG = f'"model-catalog-{MODEL_CATALOG.version}"'


@router.get(
    "/models",
    response_model=ModelCatalog,
    responses={304: {"description": "Not modified"}},
)
async def get_model_catalog(http_request: Request, response: Response) -> ModelCatalog | Response:
    """Return the curated model catalog used by web and mobile clients."""
    headers = {
        "Cache-Control": MODEL_CATALOG_CACHE_CONTROL,
        "ETag": MODEL_CATALOG_ETAG,
    }
    if http_request.headers.get("if-none-match") == MODEL_CATALOG_ETAG:
        return Response(status_code=304, headers=headers)

    response.headers.update(headers)
    return MODEL_CATALOG


@router.post("")
async def ask(
    request: AskRequest,
    http_request: Request,
    user_id: Annotated[str, Depends(get_current_user_id)],
) -> EventSourceResponse:
    """Ask a question and stream SSE events.

    If `request.request_id` matches an in-progress or recently-finished run
    for this user, re-attach instead of starting a new LLM call.
    """
    logger.info(f"Ask request from user {user_id}: {request.question[:100]}")

    request_id = request.request_id or uuid.uuid4().hex
    existing = ask_run_store.get(request_id)

    if existing is not None:
        if existing.user_id != user_id:
            raise HTTPException(status_code=403, detail="request_id belongs to another user")
        logger.info("Re-attaching to existing ask run %s", request_id)
        return EventSourceResponse(
            tail_run(existing, from_seq=-1, http_request=http_request, include_resume_ack=False)
        )

    run = ask_run_store.create(request_id, user_id)
    run.task = asyncio.create_task(run_ask_in_background(run, request))

    return EventSourceResponse(
        tail_run(run, from_seq=-1, http_request=http_request, include_resume_ack=False)
    )


@router.get("/{request_id}/stream")
async def resume_ask(
    request_id: str,
    http_request: Request,
    user_id: Annotated[str, Depends(get_current_user_id)],
    from_seq: int = -1,
) -> EventSourceResponse:
    """Resume tailing an in-flight or recently-finished ask run.

    `from_seq` is exclusive; events with seq > from_seq are emitted. Also honors
    `Last-Event-ID` if `from_seq` is left at the default.
    """
    run = ask_run_store.get(request_id)
    if run is None:
        raise HTTPException(status_code=404, detail="request_id not found or expired")
    if run.user_id != user_id:
        raise HTTPException(status_code=403, detail="request_id belongs to another user")
    if run.overflow:
        raise HTTPException(status_code=410, detail="run buffer overflowed; cannot resume")

    if from_seq == -1:
        last_event_id = http_request.headers.get("last-event-id")
        if last_event_id is not None:
            try:
                from_seq = int(last_event_id)
            except ValueError:
                pass

    logger.info("Resuming ask run %s from seq=%d", request_id, from_seq)
    return EventSourceResponse(
        tail_run(run, from_seq=from_seq, http_request=http_request, include_resume_ack=True)
    )


@router.post("/reflect/{source_id}")
async def reflect(
    source_id: int,
    request: ReflectRequest,
    user_id: Annotated[str, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
    voyage_client: Annotated[VoyageClient, Depends(get_voyage)],
) -> EventSourceResponse:
    """Reflect on a single source — same SSE events as /ask, plus suggestions."""
    logger.info(
        f"Reflect request from user {user_id}, source {source_id}: {request.question[:100]}"
    )
    source = RAGService(db, voyage_client).reflect_stream(
        user_id=user_id,
        source_id=source_id,
        request=request,
    )
    return EventSourceResponse(stream_events(source, db, error_label="RAG reflect"))


@router.delete("/reflect/{source_id}/session")
async def clear_reflect_session(
    source_id: int,
    user_id: Annotated[str, Depends(get_current_user_id)],
) -> dict[str, bool]:
    """Clear the in-memory reflection session for a source."""
    reflect_session_store.clear(user_id, source_id)
    return {"ok": True}
