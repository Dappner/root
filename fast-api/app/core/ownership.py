"""Resource ownership helpers.

Single place where "does this user own this resource?" lives. Routes and
services call `require_*` helpers instead of repeating `WHERE user_id = ...`
queries or inline `if resource.user_id != user_id` checks.

All helpers raise `AuthorizationError` (-> HTTP 403) when the resource is
missing or owned by someone else. We don't distinguish missing-vs-forbidden
here — 403 across the board is easier to debug than a 404 that hides whether
the row exists.
"""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import AuthorizationError
from app.models.database import Capture, Citation, Note, Source, SourceTakeaway, Suggestion, Tag


def _denied(resource: str, resource_id: int | str) -> AuthorizationError:
    return AuthorizationError(f"{resource} {resource_id} not accessible")


async def require_source(db: AsyncSession, source_id: int, user_id: str) -> Source:
    result = await db.execute(
        select(Source).where(Source.id == source_id, Source.user_id == user_id)
    )
    source = result.scalar_one_or_none()
    if source is None:
        raise _denied("source", source_id)
    return source


async def require_citation(db: AsyncSession, citation_id: int, user_id: str) -> Citation:
    result = await db.execute(
        select(Citation).where(Citation.id == citation_id, Citation.user_id == user_id)
    )
    citation = result.scalar_one_or_none()
    if citation is None:
        raise _denied("citation", citation_id)
    return citation


async def require_capture(db: AsyncSession, capture_id: int, user_id: str) -> Capture:
    result = await db.execute(
        select(Capture).where(Capture.id == capture_id, Capture.user_id == user_id)
    )
    capture = result.scalar_one_or_none()
    if capture is None:
        raise _denied("capture", capture_id)
    return capture


async def require_takeaway(
    db: AsyncSession,
    takeaway_id: int,
    user_id: str,
    *,
    source_id: int | None = None,
) -> SourceTakeaway:
    """Fetch a takeaway owned by `user_id`.

    If `source_id` is supplied (route-scoped lookups like
    `/sources/{source_id}/takeaways/{takeaway_id}`), the takeaway must also
    belong to that source. A mismatch raises AuthorizationError rather than
    leaking the takeaway's real source_id.
    """
    result = await db.execute(
        select(SourceTakeaway).where(
            SourceTakeaway.id == takeaway_id,
            SourceTakeaway.user_id == user_id,
        )
    )
    takeaway = result.scalar_one_or_none()
    if takeaway is None:
        raise _denied("takeaway", takeaway_id)
    if source_id is not None and takeaway.source_id != source_id:
        raise _denied("takeaway", takeaway_id)
    return takeaway


async def require_note(db: AsyncSession, note_id: int, user_id: str) -> Note:
    result = await db.execute(select(Note).where(Note.id == note_id, Note.user_id == user_id))
    note = result.scalar_one_or_none()
    if note is None:
        raise _denied("note", note_id)
    return note


async def require_tag(db: AsyncSession, tag_id: int, user_id: str) -> Tag:
    result = await db.execute(select(Tag).where(Tag.id == tag_id, Tag.user_id == user_id))
    tag = result.scalar_one_or_none()
    if tag is None:
        raise _denied("tag", tag_id)
    return tag


async def require_suggestion(db: AsyncSession, suggestion_id: int, user_id: str) -> Suggestion:
    result = await db.execute(
        select(Suggestion).where(Suggestion.id == suggestion_id, Suggestion.user_id == user_id)
    )
    suggestion = result.scalar_one_or_none()
    if suggestion is None:
        raise _denied("suggestion", suggestion_id)
    return suggestion


async def require_citations(db: AsyncSession, citation_ids: list[int], user_id: str) -> None:
    """Bulk variant: verify the user owns every citation in `citation_ids`."""
    for cid in citation_ids:
        await require_citation(db, cid, user_id)


async def require_captures(db: AsyncSession, capture_ids: list[int], user_id: str) -> None:
    """Bulk variant: verify the user owns every capture in `capture_ids`."""
    for cid in capture_ids:
        await require_capture(db, cid, user_id)
