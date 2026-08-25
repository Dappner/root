"""Cross-field validation for citation locations.

Structural validation (which fields are required, are page numbers >= 1, etc.)
lives on the pydantic models in `app/schemas/citation_location.py`. This module
covers the rules that need a DB read:

- the location's type must be compatible with the source's type
- PDF page numbers must not exceed the source's page count
- section ownership (section belongs to source, user owns the source)
"""

from __future__ import annotations

import json

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ValidationError
from app.core.ownership import require_source
from app.models.database import Source
from app.repositories.source_section_repository import SourceSectionRepository
from app.schemas.citation_location import (
    CitationLocation,
    PdfLocation,
)

# Source type → allowed location types. Unknown source types fall back to other_v1.
_SOURCE_TO_LOCATION_TYPES: dict[str, set[str]] = {
    "book": {"book_v1"},
    "pdf": {"book_v1", "pdf_v1"},
    "video": {"transcript_v1", "av_v1"},
    "podcast": {"transcript_v1", "av_v1"},
    "article": {"other_v1"},
}
_DEFAULT_LOCATION_TYPES = {"other_v1"}


def _require(cond: bool, msg: str) -> None:
    if not cond:
        raise ValidationError(msg)


def _validate_pdf_page_bounds(loc: PdfLocation, page_count: int | None) -> None:
    if page_count is None:
        return
    pos = loc.pdf.position
    _require(
        pos.page_number <= page_count,
        "pdf.position.pageNumber exceeds source page count",
    )
    _require(
        pos.bounding_rect.page_number <= page_count,
        "pdf.position.boundingRect.pageNumber exceeds source page count",
    )
    for idx, rect in enumerate(pos.rects):
        _require(
            rect.page_number <= page_count,
            f"pdf.position.rects[{idx}].pageNumber exceeds source page count",
        )


def _source_page_count(source: Source) -> int | None:
    raw = source.metadata_json
    # Legacy rows may have been stored as a JSON string.
    if isinstance(raw, str):
        try:
            raw = json.loads(raw)
        except (ValueError, TypeError):
            return None
    if not isinstance(raw, dict):
        return None
    value = raw.get("page_count")
    return value if isinstance(value, int) else None


async def validate_citation_location(
    db: AsyncSession,
    *,
    location: CitationLocation | None,
    source_id: int | None,
    user_id: str,
) -> None:
    """Validates a citation location payload against the source.

    Pydantic has already enforced shape by the time this runs. We only check
    cross-field rules that depend on the source row.
    """
    if location is None:
        return

    _require(source_id is not None, "location requires source_id to be set")
    assert source_id is not None

    source = await require_source(db, source_id, user_id)

    allowed = _SOURCE_TO_LOCATION_TYPES.get(source.type, _DEFAULT_LOCATION_TYPES)
    _require(
        location.type in allowed,
        f"location type {location.type!r} does not match source type {source.type!r}",
    )

    if isinstance(location, PdfLocation):
        _validate_pdf_page_bounds(location, _source_page_count(source))


async def validate_section_ownership(
    db: AsyncSession,
    *,
    section_id: int,
    source_id: int,
    user_id: str,
) -> None:
    """Ensure section belongs to source and user owns the source."""
    await require_source(db, source_id, user_id)

    section = await SourceSectionRepository().get(db, section_id)
    _require(section is not None, "section not found")
    assert section is not None
    _require(
        section.source_id == source_id,
        f"section {section_id} does not belong to source {source_id}",
    )
