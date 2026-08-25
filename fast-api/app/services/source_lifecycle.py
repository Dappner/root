"""Source lifecycle transitions — shared by every entity-create flow that
engages a source (captures, citations, etc.)."""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.datetime_utils import utcnow
from app.core.exceptions import ConflictError
from app.core.ownership import require_source
from app.models.database import Source
from app.repositories.source_repository import SourceRepository
from app.services.source_list_cache import invalidate_source_list_cache

# Legal (from, to) transitions and the timestamp mutation each applies.
# `set` columns are stamped with now(); `clear` columns are nulled. `status`
# and `updated_at` always change. A pair not present here is rejected as an
# illegal transition.
_TRANSITIONS: dict[tuple[str, str], tuple[tuple[str, ...], tuple[str, ...]]] = {
    ("todo", "in_progress"): (("started_at", "last_active_at"), ()),
    ("in_progress", "todo"): ((), ("started_at",)),
    ("in_progress", "reflecting"): (("reflecting_at",), ()),
    ("reflecting", "in_progress"): ((), ("reflecting_at",)),
    ("reflecting", "done"): (("completed_at",), ()),
    ("done", "reflecting"): ((), ("completed_at",)),
}


async def maybe_start_source(
    db: AsyncSession,
    *,
    source_id: int,
    user_id: str,
) -> bool:
    """Transition a source from todo→in_progress on first engagement.

    Returns True when the status transition was made, False otherwise.

    - When status is `todo`: sets status=in_progress, started_at=now(),
      last_active_at=now(), updated_at=now().
    - Otherwise: only bumps `last_active_at` and `updated_at`.

    Silently returns False when the source does not exist (or is not owned
    by `user_id`); a missing source is treated as a no-op.
    """
    source = await SourceRepository().get_for_user(db, source_id, user_id)
    if source is None:
        return False

    now = utcnow()
    if source.status != "todo":
        source.last_active_at = now
        source.updated_at = now
        await invalidate_source_list_cache(user_id)
        return False

    # Status transition is intentionally NOT propagated into embedded
    # documents — see SourceEmbeddingContext for the rationale and the
    # long-term fix (document-level hash on rag_embeddings).
    source.status = "in_progress"
    source.started_at = now
    source.last_active_at = now
    source.updated_at = now
    await invalidate_source_list_cache(user_id)
    return True


async def transition_source_status(
    db: AsyncSession,
    *,
    source_id: int,
    user_id: str,
    target: str,
) -> Source:
    """Move a source between lifecycle states (todo/in_progress/reflecting/done).

    Validates the transition against `_TRANSITIONS`: a `(current, target)` pair
    not present raises `ConflictError`. A no-op (`current == target`) returns the
    source unchanged. Stamps/clears the timestamp columns the transition owns.

    Status transitions deliberately do NOT delete the source's rag_embeddings —
    see SourceEmbeddingContext for the document-hash direction.
    """
    source = await require_source(db, source_id, user_id)

    if source.status == target:
        return source

    mutation = _TRANSITIONS.get((source.status, target))
    if mutation is None:
        raise ConflictError(
            f"cannot transition source {source_id} from {source.status} to {target}"
        )

    to_set, to_clear = mutation
    now = utcnow()
    source.status = target
    for column in to_set:
        setattr(source, column, now)
    for column in to_clear:
        setattr(source, column, None)
    source.updated_at = now
    await invalidate_source_list_cache(user_id)
    return source


async def update_source_summaries(
    db: AsyncSession,
    *,
    source_id: int,
    user_id: str,
    summary_long: str | None,
) -> Source:
    """Write a source's long summary. The value is set verbatim (passing None
    clears it)."""
    source = await require_source(db, source_id, user_id)
    source.summary_long = summary_long
    source.updated_at = utcnow()
    await invalidate_source_list_cache(user_id)
    return source
