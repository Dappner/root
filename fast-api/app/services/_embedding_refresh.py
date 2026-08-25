"""Shared single-row embedding generation for entity embedding services.

The citation/capture/takeaway/section services all follow the same
fire-and-forget flow after a mutation: load the candidate row, skip if it has
no content hash or renders an empty document, embed via Voyage, upsert the
rag_embeddings row, commit. Only the candidate lookup, document rendering, and
upsert differ per entity — services pass those in as callables.

Batch refresh of stale rows lives in `_embedding_batch.refresh_stale_embeddings`.
"""

from __future__ import annotations

import logging
from collections.abc import Awaitable, Callable, Iterable
from datetime import datetime
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.core.config import settings
from app.integrations.voyage import VoyageClient

DocumentValue = str | int | datetime | None
DocumentField = tuple[str, DocumentValue]


def render_embedding_document(fields: Iterable[DocumentField]) -> str:
    """Render labeled fields into the canonical embedded-document text.

    None values and fields that render empty are dropped; datetimes are
    rendered as YYYY-MM-DD.
    """
    lines: list[str] = []
    for label, value in fields:
        if value is None:
            continue
        if isinstance(value, datetime):
            rendered = value.strftime("%Y-%m-%d")
        else:
            rendered = str(value).strip()
        if rendered:
            lines.append(f"{label}: {rendered}")
    return "\n".join(lines)


async def generate_entity_embedding(
    *,
    session_factory: async_sessionmaker[AsyncSession],
    voyage: VoyageClient,
    logger: logging.Logger,
    log_label: str,
    log_extra: dict[str, Any],
    get_candidate: Callable[[AsyncSession], Awaitable[Any]],
    content_hash: Callable[[Any], str | None],
    build_document: Callable[[Any], str],
    upsert: Callable[[AsyncSession, str, list[float] | list[int]], Awaitable[None]],
) -> None:
    """Generate and store the embedding for one entity row.

    Opens its own session (background-task unit of work) and commits on
    success; any failure is logged, never raised — embedding generation must
    not break the mutation that triggered it.

    ``upsert`` receives ``(db, content_sha256, vector)``; the caller closes
    over the entity id and supplies model/timestamp.
    """
    async with session_factory() as db:
        try:
            candidate = await get_candidate(db)
            if candidate is None:
                return

            sha = content_hash(candidate)
            if not sha:
                return

            document = build_document(candidate)
            if not document.strip():
                return

            embed_result = await voyage.embed(
                texts=[document],
                model=settings.embedding_model,
                input_type="document",
            )
            if not embed_result.embeddings:
                return
            vector = embed_result.embeddings[0]

            await upsert(db, sha, vector)
            await db.commit()
        except Exception:
            logger.exception(f"failed to generate {log_label} embedding", extra=log_extra)
