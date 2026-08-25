"""Source CRUD — list/get/create/update/delete.

Functions take `db: AsyncSession` and never commit; the `get_db` dependency owns
the request transaction (every update step lands in that one tx). Follows the
`source_lifecycle` / `source_pdf_service` module-of-functions style.
"""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.cache_decorator import cached
from app.core.datetime_utils import to_naive_utc, utcnow
from app.core.exceptions import ConflictError, NotFoundError, ValidationError
from app.core.ownership import require_source
from app.core.url import normalize_url
from app.integrations.r2 import R2Client
from app.repositories.source_repository import SourceRepository
from app.schemas.source_metadata import validate_source_metadata
from app.schemas.sources import CreateSourceRequest, SourceDTO, UpdateSourceRequest
from app.services.source_list_cache import (
    SOURCE_LIST_CACHE_TTL_SECONDS,
    invalidate_source_list_cache,
    source_list_cache_key,
)
from app.services.source_pdf_service import delete_stored_pdf

_repo = SourceRepository()

# Source types whose metadata carries a `url` we canonicalize on create.
_URL_TYPES = frozenset({"article", "video", "podcast"})


def _normalize_author(author: str | None) -> str | None:
    if author is None:
        return None
    trimmed = author.strip()
    return trimmed or None


def _normalize_status(status: str | None) -> str:
    return status or "todo"


@cached(
    key=source_list_cache_key,
    ttl=SOURCE_LIST_CACHE_TTL_SECONDS,
    model=SourceDTO,
    is_list=True,
)
async def _list_sources_cached(*, db: AsyncSession, user_id: str) -> list[SourceDTO]:
    return await _repo.list_source_details(db, user_id)


async def list_sources(db: AsyncSession, user_id: str) -> list[SourceDTO]:
    return await _list_sources_cached(db=db, user_id=user_id)


async def get_source(db: AsyncSession, user_id: str, source_id: int) -> SourceDTO:
    await require_source(db, source_id, user_id)
    detail = await _repo.get_source_detail(db, user_id, source_id)
    if detail is None:
        raise NotFoundError("source", source_id)
    return detail


async def create_source(db: AsyncSession, user_id: str, req: CreateSourceRequest) -> SourceDTO:
    title = req.title.strip()
    if not title:
        raise ValidationError("title is required")

    existing_id = await _repo.find_by_title_and_type(db, user_id, title, req.type)
    if existing_id is not None:
        raise ConflictError(f"A source with this title and type already exists (ID: {existing_id})")

    validate_source_metadata(req.metadata, req.type)

    metadata = dict(req.metadata) if req.metadata else {}
    if req.type in _URL_TYPES and metadata.get("url"):
        metadata["url"] = normalize_url(metadata["url"])

    new_id = await _repo.create_source(
        db,
        user_id,
        title=title,
        type=req.type,
        status=_normalize_status(req.status),
        metadata=metadata,
        label=req.label,
        author=_normalize_author(req.author),
        published_at=req.published_at,
    )

    detail = await _repo.get_source_detail(db, user_id, new_id)
    if detail is None:  # pragma: no cover - just-inserted row must exist
        raise NotFoundError("source", new_id)
    await invalidate_source_list_cache(user_id)
    return detail


async def update_source(
    db: AsyncSession, user_id: str, source_id: int, req: UpdateSourceRequest
) -> SourceDTO:
    source = await require_source(db, source_id, user_id)

    # Validate metadata against the effective type (payload type if provided).
    effective_type = req.type if req.type is not None else source.type
    validate_source_metadata(req.metadata, effective_type)

    # PUT-merge: only non-None fields are applied. URL normalization happens
    # only on create, not update.
    if req.title is not None:
        source.title = req.title
    if req.type is not None:
        source.type = req.type
    if req.status is not None:
        source.status = _normalize_status(req.status)
    if req.metadata is not None:
        source.metadata_json = req.metadata
    if req.label is not None:
        source.label = req.label
    if req.author is not None:
        source.author = _normalize_author(req.author)
    if req.published_at is not None:
        source.published_at = to_naive_utc(req.published_at)
    source.updated_at = utcnow()

    await _repo.delete_embeddings_for_source(db, source_id)

    if req.tag_ids is not None:
        await _repo.set_tags_for_source(db, user_id, source_id, req.tag_ids)

    await db.flush()

    detail = await _repo.get_source_detail(db, user_id, source_id)
    if detail is None:  # pragma: no cover - the row was just updated
        raise NotFoundError("source", source_id)
    await invalidate_source_list_cache(user_id)
    return detail


async def delete_source(db: AsyncSession, user_id: str, source_id: int, r2: R2Client) -> None:
    source = await require_source(db, source_id, user_id)

    if source.type == "pdf":
        delete_stored_pdf(source, r2)

    await _repo.delete_source(db, source_id, user_id)
    await invalidate_source_list_cache(user_id)
