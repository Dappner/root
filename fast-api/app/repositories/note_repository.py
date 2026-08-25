from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import Select, delete, func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.database import Citation, Note, NoteCitation

LIST_PREVIEW_LEN = 200


@dataclass(frozen=True)
class NoteListRow:
    """Row shape for list endpoints — omits body, ships only a truncated preview."""

    id: int
    user_id: str
    source_id: int | None
    title: str
    kind: str
    preview: str
    created_at: datetime
    updated_at: datetime


def _list_select() -> Select:
    # Avoid loading the JSONB body and truncate plain_text at the DB so
    # multi-megabyte notes don't get pulled into Python for a list view.
    return select(
        Note.id,
        Note.user_id,
        Note.source_id,
        Note.title,
        Note.kind,
        func.left(Note.plain_text, LIST_PREVIEW_LEN).label("preview"),
        Note.created_at,
        Note.updated_at,
    )


class NoteRepository:
    async def create(self, db: AsyncSession, note: Note) -> Note:
        db.add(note)
        await db.flush()
        return note

    async def get(self, db: AsyncSession, note_id: int, user_id: str) -> Note | None:
        result = await db.execute(select(Note).where(Note.id == note_id, Note.user_id == user_id))
        return result.scalar_one_or_none()

    async def list_for_user(self, db: AsyncSession, user_id: str) -> list[NoteListRow]:
        result = await db.execute(
            _list_select().where(Note.user_id == user_id).order_by(Note.updated_at.desc())
        )
        return [NoteListRow(**row._mapping) for row in result.all()]

    async def list_for_source(
        self, db: AsyncSession, user_id: str, source_id: int
    ) -> list[NoteListRow]:
        result = await db.execute(
            _list_select()
            .where(Note.user_id == user_id, Note.source_id == source_id)
            .order_by(Note.updated_at.desc())
        )
        return [NoteListRow(**row._mapping) for row in result.all()]

    async def delete_by_id(self, db: AsyncSession, note_id: int) -> None:
        await db.execute(delete(Note).where(Note.id == note_id))

    async def list_citation_ids(self, db: AsyncSession, note_id: int) -> list[int]:
        result = await db.execute(
            select(NoteCitation.citation_id)
            .where(NoteCitation.note_id == note_id)
            .order_by(NoteCitation.citation_id)
        )
        return [row for row in result.scalars()]

    async def sync_citations(self, db: AsyncSession, note_id: int, citation_ids: list[int]) -> None:
        """Reconcile note_citations for a note.

        Keeps the join table in lockstep with the citation refs in the JSON body.
        """
        if not citation_ids:
            await db.execute(delete(NoteCitation).where(NoteCitation.note_id == note_id))
            return
        await db.execute(
            delete(NoteCitation).where(
                NoteCitation.note_id == note_id,
                NoteCitation.citation_id.notin_(citation_ids),
            )
        )
        await db.execute(
            pg_insert(NoteCitation)
            .values([{"note_id": note_id, "citation_id": cid} for cid in citation_ids])
            .on_conflict_do_nothing(index_elements=["note_id", "citation_id"])
        )

    async def count_owned_citations(
        self,
        db: AsyncSession,
        user_id: str,
        citation_ids: list[int],
        source_id: int | None = None,
    ) -> int:
        stmt = select(func.count()).where(
            Citation.user_id == user_id, Citation.id.in_(citation_ids)
        )
        if source_id is not None:
            stmt = stmt.where(Citation.source_id == source_id)
        result = await db.execute(stmt)
        return int(result.scalar_one())
