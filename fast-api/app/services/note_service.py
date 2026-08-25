from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.datetime_utils import to_aware_utc, utcnow
from app.core.exceptions import AuthorizationError, ConflictError
from app.core.ownership import require_note, require_source
from app.core.tiptap import tiptap_to_plain_text
from app.models.database import Note
from app.repositories.note_repository import NoteListRow, NoteRepository


def _normalize_ids(ids: list[int]) -> list[int]:
    """Dedupe + sort (bulk citation insert relies on no dupes)."""
    return sorted(set(ids))


def _normalize_kind(kind: str | None) -> str:
    return kind or "note"


class NoteService:
    def __init__(self, repo: NoteRepository | None = None) -> None:
        self._repo = repo or NoteRepository()

    async def _validate_scope(
        self,
        db: AsyncSession,
        *,
        user_id: str,
        source_id: int | None,
        citation_ids: list[int],
    ) -> None:
        if source_id is not None:
            await require_source(db, source_id, user_id)
        if not citation_ids:
            return
        count = await self._repo.count_owned_citations(
            db, user_id=user_id, citation_ids=citation_ids, source_id=source_id
        )
        if count != len(citation_ids):
            raise AuthorizationError("one or more citations not accessible")

    async def create(
        self,
        *,
        db: AsyncSession,
        user_id: str,
        title: str,
        kind: str,
        source_id: int | None,
        body: dict[str, Any],
        citation_ids: list[int],
    ) -> tuple[Note, list[int]]:
        normalized = _normalize_ids(citation_ids)
        await self._validate_scope(
            db, user_id=user_id, source_id=source_id, citation_ids=normalized
        )

        now = utcnow()
        note = await self._repo.create(
            db,
            Note(
                user_id=user_id,
                title=title,
                kind=_normalize_kind(kind),
                source_id=source_id,
                body=body,
                plain_text=tiptap_to_plain_text(body),
                created_at=now,
                updated_at=now,
            ),
        )
        await self._repo.sync_citations(db, note.id, normalized)
        await db.flush()
        await db.refresh(note)
        return note, normalized

    async def get(self, *, db: AsyncSession, user_id: str, note_id: int) -> tuple[Note, list[int]]:
        note = await require_note(db, note_id, user_id)
        citation_ids = await self._repo.list_citation_ids(db, note.id)
        return note, citation_ids

    async def list_for_user(self, *, db: AsyncSession, user_id: str) -> list[NoteListRow]:
        return await self._repo.list_for_user(db, user_id)

    async def list_for_source(
        self, *, db: AsyncSession, user_id: str, source_id: int
    ) -> list[NoteListRow]:
        await require_source(db, source_id, user_id)
        return await self._repo.list_for_source(db, user_id, source_id)

    async def update(
        self,
        *,
        db: AsyncSession,
        user_id: str,
        note_id: int,
        title: str,
        kind: str | None,
        source_id: int | None,
        body: dict[str, Any],
        citation_ids: list[int],
        expected_updated_at: str | None = None,
    ) -> tuple[Note, list[int]]:
        note = await require_note(db, note_id, user_id)

        if expected_updated_at is not None:
            # Frontend sends RFC3339Nano from the prior GET. The DB column is
            # TIMESTAMPTZ so asyncpg returns aware instants, but our writes use
            # `utcnow()` which is naive UTC — normalize both sides to aware UTC
            # before comparing so autosaves don't 409 spuriously.
            try:
                parsed = datetime.fromisoformat(expected_updated_at.replace("Z", "+00:00"))
            except ValueError as exc:
                raise ConflictError("invalid X-Expected-Updated-At header") from exc
            if to_aware_utc(parsed) != to_aware_utc(note.updated_at):
                raise ConflictError("note has changed since it was loaded; refresh and retry")

        normalized = _normalize_ids(citation_ids)
        effective_source_id = source_id if source_id is not None else note.source_id
        effective_kind = _normalize_kind(kind or note.kind)
        await self._validate_scope(
            db, user_id=user_id, source_id=effective_source_id, citation_ids=normalized
        )

        note.title = title
        note.kind = effective_kind
        note.source_id = effective_source_id
        note.body = body
        note.plain_text = tiptap_to_plain_text(body)
        note.updated_at = utcnow()

        await self._repo.sync_citations(db, note.id, normalized)
        await db.flush()
        await db.refresh(note)
        return note, normalized

    async def delete(self, *, db: AsyncSession, user_id: str, note_id: int) -> None:
        note = await require_note(db, note_id, user_id)
        # note_citations FK has ON DELETE CASCADE per migration 000018.
        await self._repo.delete_by_id(db, note.id)
