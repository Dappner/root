"""PDF upload + retrieval for `pdf`-type sources.

R2 storage lives in R2Client; this module owns the source-side orchestration:
object-key resolution, replace-existing cleanup of PDF-derived highlights,
metadata normalization, and cache-busted URL retrieval.
"""

from __future__ import annotations

import uuid
from urllib.parse import parse_qs, urlencode, urlparse, urlunparse

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.datetime_utils import utcnow
from app.core.exceptions import ConflictError, NotFoundError, ValidationError
from app.core.ownership import require_source
from app.integrations.r2 import R2Client
from app.models.database import Source
from app.repositories.citation_repository import CitationRepository

MAX_PDF_BYTES = 50 * 1024 * 1024


def _new_object_key() -> str:
    return f"pdfs/{uuid.uuid4()}/original.pdf"


def _legacy_object_key(user_id: str, source_id: int) -> str:
    return f"user-buckets/{user_id}/pdfs/{source_id}/original.pdf"


def resolve_object_key(source: Source) -> str:
    """Stored key if present, else the legacy deterministic key."""
    if source.pdf_object_key:
        return source.pdf_object_key
    if not source.user_id or not source.id:
        return ""
    return _legacy_object_key(source.user_id, source.id)


# Back-compat alias for the previously module-private name.
_resolve_object_key = resolve_object_key


def delete_stored_pdf(source: Source, r2: R2Client) -> None:
    """Delete a source's stored PDF object from R2 if storage is available and a
    key resolves. No-op otherwise. Shared by `source_service.delete_source`."""
    if not r2.is_available():
        return
    object_key = resolve_object_key(source)
    if object_key:
        r2.delete(object_key)


def _normalize_pdf_metadata(metadata: dict, size_bytes: int) -> dict:
    """Drop stale derived fields and stamp the new size."""
    normalized = dict(metadata or {})
    normalized.pop("page_count", None)
    normalized.pop("has_text_layer", None)
    normalized["size_bytes"] = size_bytes
    return normalized


async def _delete_pdf_derived_highlights(db: AsyncSession, *, user_id: str, source_id: int) -> None:
    """Remove captures + citations derived from a previous PDF (location type
    `pdf_v1`) before a replacement upload. Captures are deleted first since
    they reference the citations."""
    await CitationRepository().delete_pdf_derived(db, user_id=user_id, source_id=source_id)


async def upload_pdf(
    db: AsyncSession,
    r2: R2Client,
    *,
    source_id: int,
    user_id: str,
    content_type: str,
    data: bytes,
) -> int:
    """Store a PDF for a source and update its metadata. Returns the byte size.

    Replacing an existing PDF first deletes any highlights derived from the old
    one. Raises ConflictError if storage is unavailable, ValidationError on a
    bad source type / payload.
    """
    if not r2.is_available():
        raise ConflictError("PDF storage is not configured")

    source = await require_source(db, source_id, user_id)
    if source.type != "pdf":
        raise ValidationError("source type must be pdf to upload a PDF file")
    if len(data) == 0 or len(data) > MAX_PDF_BYTES:
        raise ValidationError("invalid PDF upload")
    if "pdf" not in content_type.lower():
        raise ValidationError("invalid file type; PDF required")

    object_key = _resolve_object_key(source) or _new_object_key()

    replacing_existing = False
    current_key = _resolve_object_key(source)
    if current_key:
        replacing_existing = r2.exists(current_key)

    r2.upload_bytes(object_key, data, content_type)

    if replacing_existing:
        await _delete_pdf_derived_highlights(db, user_id=user_id, source_id=source_id)

    source.pdf_object_key = object_key
    source.metadata_json = _normalize_pdf_metadata(source.metadata_json, len(data))
    source.updated_at = utcnow()
    return len(data)


async def get_pdf_url(
    db: AsyncSession,
    r2: R2Client,
    *,
    source_id: int,
    user_id: str,
) -> str:
    """Return a fetchable URL for a source's stored PDF.

    Appends a `v=<updated_at>` cache-buster to non-presigned (public) URLs so
    clients pick up replacements. Raises NotFoundError when no PDF is stored.
    """
    if not r2.is_available():
        raise ConflictError("PDF storage is not configured")

    source = await require_source(db, source_id, user_id)
    if source.type != "pdf":
        raise ValidationError("source is not a PDF source")

    object_key = _resolve_object_key(source)
    if not object_key or not r2.exists(object_key):
        raise NotFoundError("pdf", source_id)

    raw_url = r2.get_public_url(object_key)

    if source.updated_at is None:
        return raw_url

    parsed = urlparse(raw_url)
    query = parse_qs(parsed.query)
    # Presigned URLs already carry signing params; don't disturb them.
    if "X-Amz-Signature" in query or "X-Amz-Algorithm" in query:
        return raw_url

    query["v"] = [str(int(source.updated_at.timestamp()))]
    return urlunparse(parsed._replace(query=urlencode(query, doseq=True)))
