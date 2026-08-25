"""Data access for the citation-pivoted local neighborhood graph.

DATA ACCESS ONLY: builds/executes queries and returns row tuples / scalars /
ORM objects. Aggregation, dedup, per-citation capping, and GraphNode /
NeighborhoodConnection construction live in
`app.services.neighborhood_service`.
"""

from __future__ import annotations

from collections.abc import Sequence
from typing import Any

from sqlalchemy import Row, Select, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.database import (
    Citation,
    Note,
    NoteCitation,
    Source,
    SourceTakeaway,
    SourceTakeawayCitation,
)


class NeighborhoodRepository:
    async def fetch_source(self, db: AsyncSession, source_id: int | None) -> Source | None:
        if source_id is None:
            return None
        result = await db.execute(select(Source).where(Source.id == source_id))
        return result.scalar_one_or_none()

    async def fetch_note_center(
        self, db: AsyncSession, *, user_id: str, note_id: int
    ) -> Row[Any] | None:
        result = await db.execute(
            select(Note, Source.title.label("source_title"), Source.type.label("source_type"))
            .outerjoin(Source, Source.id == Note.source_id)
            .where(Note.id == note_id, Note.user_id == user_id)
        )
        return result.first()

    async def fetch_citation_nodes(
        self,
        db: AsyncSession,
        *,
        user_id: str,
        citation_ids_stmt: Select[tuple[int]],
    ) -> Sequence[Row[Any]]:
        # Defense-in-depth: even though `citation_ids_stmt` comes from a join
        # table already scoped to the caller's takeaway/note, re-assert
        # ownership at the citation level so any inconsistent join row can't
        # surface another user's citation.
        result = await db.execute(
            select(
                Citation.id,
                Citation.text,
                Citation.source_id,
                Citation.location,
                Citation.speaker,
                Source.title.label("source_title"),
                Source.type.label("source_type"),
            )
            .outerjoin(Source, Source.id == Citation.source_id)
            .where(Citation.id.in_(citation_ids_stmt), Citation.user_id == user_id)
        )
        return result.all()

    async def fetch_takeaway_connections(
        self,
        db: AsyncSession,
        *,
        user_id: str,
        citation_ids: list[int],
        exclude_takeaway_id: int | None,
    ) -> Sequence[Row[Any]]:
        # Other takeaways touching any of these citations.
        stmt = (
            select(
                SourceTakeawayCitation.citation_id,
                SourceTakeaway.id,
                SourceTakeaway.title,
                SourceTakeaway.source_id,
                Source.title.label("source_title"),
                Source.type.label("source_type"),
            )
            .select_from(SourceTakeawayCitation)
            .join(SourceTakeaway, SourceTakeaway.id == SourceTakeawayCitation.takeaway_id)
            .join(Source, Source.id == SourceTakeaway.source_id)
            .where(
                SourceTakeawayCitation.citation_id.in_(citation_ids),
                SourceTakeaway.user_id == user_id,
            )
        )
        if exclude_takeaway_id is not None:
            stmt = stmt.where(SourceTakeaway.id != exclude_takeaway_id)
        result = await db.execute(stmt)
        return result.all()

    async def fetch_note_connections(
        self,
        db: AsyncSession,
        *,
        user_id: str,
        citation_ids: list[int],
        exclude_note_id: int | None,
    ) -> Sequence[Row[Any]]:
        # Notes touching any of these citations.
        stmt = (
            select(
                NoteCitation.citation_id,
                Note.id,
                Note.title,
                Note.source_id,
                Source.title.label("source_title"),
                Source.type.label("source_type"),
            )
            .select_from(NoteCitation)
            .join(Note, Note.id == NoteCitation.note_id)
            .outerjoin(Source, Source.id == Note.source_id)
            .where(
                NoteCitation.citation_id.in_(citation_ids),
                Note.user_id == user_id,
            )
        )
        if exclude_note_id is not None:
            stmt = stmt.where(Note.id != exclude_note_id)
        result = await db.execute(stmt)
        return result.all()
