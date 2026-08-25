"""Source-section CRUD — get/create/update/delete/reorder.

Functions take `db: AsyncSession` and never commit; the `get_db` dependency owns
the request transaction (every step lands in that one tx). The route schedules
embedding generation as a background task after the tx commits.

A section that exists but doesn't belong to the requested source raises
`NotFoundError`; the membership check doesn't leak the section's real source.
"""

from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.datetime_utils import utcnow
from app.core.exceptions import NotFoundError, ValidationError
from app.core.hashing import sha256_hex
from app.core.ownership import require_source
from app.models.database import SourceSection
from app.repositories.section_embedding_repository import SectionEmbeddingRepository
from app.repositories.source_section_repository import SourceSectionRepository

_repo = SourceSectionRepository()
_embedding_repo = SectionEmbeddingRepository()


@dataclass(frozen=True)
class SectionMutationResult:
    """Returned by create/update so the route knows whether to schedule
    background embedding generation (only when a summary is present)."""

    section: SourceSection
    needs_embedding: bool


def build_section_embedding_text(title: str, subtitle: str | None, summary: str) -> str:
    """Title, optional non-empty subtitle, and summary joined by " - ". Feeds
    `summary_sha256`."""
    parts = [title]
    if subtitle is not None and subtitle != "":
        parts.append(subtitle)
    parts.append(summary)
    return " - ".join(parts)


def _section_summary_hash(title: str, subtitle: str | None, summary: str) -> str:
    return sha256_hex(build_section_embedding_text(title, subtitle, summary))


def _normalize_optional_text(value: str | None) -> str | None:
    """Trim; empty -> None."""
    if value is None:
        return None
    trimmed = value.strip()
    return trimmed or None


def _validate_range(range_start: int | None, range_end: int | None) -> None:
    if range_start is not None and range_end is not None and range_end < range_start:
        raise ValidationError("range_end cannot be before range_start")


async def get_section(
    db: AsyncSession, *, user_id: str, source_id: int, section_id: int
) -> SourceSection:
    await require_source(db, source_id, user_id)
    section = await _repo.get(db, section_id)
    if section is None or section.source_id != source_id:
        raise NotFoundError("section", section_id)
    return section


async def list_sections(db: AsyncSession, *, user_id: str, source_id: int) -> list[SourceSection]:
    await require_source(db, source_id, user_id)
    return await _repo.list_by_source(db, source_id)


async def create_section(
    db: AsyncSession,
    *,
    user_id: str,
    source_id: int,
    title: str,
    subtitle: str | None,
    summary: str | None,
    range_start: int | None,
    range_end: int | None,
) -> SectionMutationResult:
    title = title.strip()
    if not title:
        raise ValidationError("title is required")
    subtitle = _normalize_optional_text(subtitle)
    summary = _normalize_optional_text(summary)
    _validate_range(range_start, range_end)

    await require_source(db, source_id, user_id)

    summary_sha256 = (
        _section_summary_hash(title, subtitle, summary) if summary is not None else None
    )

    new_id = await _repo.create(
        db,
        source_id=source_id,
        title=title,
        subtitle=subtitle,
        summary=summary,
        summary_sha256=summary_sha256,
        range_start=range_start,
        range_end=range_end,
    )
    section = await _repo.get(db, new_id)
    if section is None:  # pragma: no cover - just-inserted row must exist
        raise NotFoundError("section", new_id)
    return SectionMutationResult(section=section, needs_embedding=summary is not None)


async def update_section(
    db: AsyncSession,
    *,
    user_id: str,
    source_id: int,
    section_id: int,
    title: str,
    subtitle: str | None,
    summary: str | None,
    range_start: int | None,
    range_end: int | None,
) -> SectionMutationResult:
    title = title.strip()
    if not title:
        raise ValidationError("title is required")
    subtitle = _normalize_optional_text(subtitle)
    summary = _normalize_optional_text(summary)
    _validate_range(range_start, range_end)

    section = await get_section(db, user_id=user_id, source_id=source_id, section_id=section_id)

    summary_sha256 = (
        _section_summary_hash(title, subtitle, summary) if summary is not None else None
    )

    await _repo.update(
        db,
        section,
        title=title,
        subtitle=subtitle,
        summary=summary,
        summary_sha256=summary_sha256,
        range_start=range_start,
        range_end=range_end,
        updated_at=utcnow(),
    )

    # The summary changed (or was cleared): the old embedding row is stale.
    # Drop it in-tx; if a new summary exists the route regenerates it after
    # commit. Clearing alone leaves no embedding behind.
    await _embedding_repo.delete_embedding(db, section_id)

    return SectionMutationResult(section=section, needs_embedding=summary is not None)


async def delete_section(
    db: AsyncSession, *, user_id: str, source_id: int, section_id: int
) -> None:
    await get_section(db, user_id=user_id, source_id=source_id, section_id=section_id)
    await _repo.delete(db, section_id, source_id)


async def reorder_sections(
    db: AsyncSession, *, user_id: str, source_id: int, section_ids: list[int]
) -> None:
    if not section_ids:
        raise ValidationError("section_ids must not be empty")

    await require_source(db, source_id, user_id)

    # Membership-only validation (partial sets allowed): every supplied id must
    # belong to this source. Go also enforced a full-set match for `reorder`;
    # we collapse reorder + reorder-siblings into this one membership check.
    existing_ids = {s.id for s in await _repo.list_by_source(db, source_id)}
    for sid in section_ids:
        if sid not in existing_ids:
            raise NotFoundError("section", sid)

    await _repo.reorder(db, source_id, section_ids)
