from sqlalchemy import delete, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.datetime_utils import utcnow
from app.models.database import Capture, Citation, RagEmbedding, Source

MAX_CONTEXT_ITEMS = 50


class CitationRepository:
    async def create(self, db: AsyncSession, citation: Citation) -> Citation:
        db.add(citation)
        await db.flush()
        return citation

    async def get_by_id(self, db: AsyncSession, citation_id: int) -> Citation | None:
        """Fetch a single citation by id with no ownership filter. Used by paths
        that have already established access (e.g. post-approval re-fetch)."""
        result = await db.execute(select(Citation).where(Citation.id == citation_id))
        return result.scalar_one_or_none()

    async def list_for_user(self, db: AsyncSession, user_id: str) -> list[Citation]:
        result = await db.execute(
            select(Citation).where(Citation.user_id == user_id).order_by(Citation.created_at.desc())
        )
        return list(result.scalars())

    async def list_unsorted(self, db: AsyncSession, user_id: str) -> list[Citation]:
        result = await db.execute(
            select(Citation)
            .where(Citation.user_id == user_id, Citation.source_id.is_(None))
            .order_by(Citation.created_at.desc())
        )
        return list(result.scalars())

    async def list_for_source(
        self,
        db: AsyncSession,
        user_id: str,
        source_id: int,
        section_id: int | None = None,
        limit: int | None = MAX_CONTEXT_ITEMS,
    ) -> list[Citation]:
        stmt = (
            select(Citation)
            .where(Citation.user_id == user_id, Citation.source_id == source_id)
            .order_by(Citation.created_at.desc())
        )
        if section_id is not None:
            stmt = stmt.where(Citation.section_id == section_id)
        if limit is not None:
            stmt = stmt.limit(limit)
        result = await db.execute(stmt)
        return list(result.scalars())

    async def list_uncaptured_for_source(
        self,
        db: AsyncSession,
        user_id: str,
        source_id: int,
        limit: int,
    ) -> list[tuple[Citation, str]]:
        """Citations in a source that have no active capture, paired with the
        source title. Newest first, capped at `limit`."""
        captured_citation_ids = select(Capture.citation_id).where(
            Capture.user_id == user_id,
            Capture.citation_id.is_not(None),
            Capture.deleted_at.is_(None),
        )
        stmt = (
            select(Citation, Source.title.label("source_title"))
            .join(Source, Citation.source_id == Source.id)
            .where(
                Citation.user_id == user_id,
                Citation.source_id == source_id,
                Citation.id.not_in(captured_citation_ids),
            )
            .order_by(Citation.created_at.desc())
            .limit(limit)
        )
        result = await db.execute(stmt)
        return [(row[0], row[1]) for row in result.all()]

    async def validate_ids_for_source(
        self,
        db: AsyncSession,
        user_id: str,
        source_id: int,
        citation_ids: list[int],
    ) -> list[int]:
        """Subset of `citation_ids` that exist, belong to the user, and live in
        the given source."""
        if not citation_ids:
            return []
        result = await db.execute(
            select(Citation.id).where(
                Citation.id.in_(citation_ids),
                Citation.source_id == source_id,
                Citation.user_id == user_id,
            )
        )
        return list(result.scalars())

    async def list_id_section_location_for_source(
        self, db: AsyncSession, source_id: int
    ) -> list[tuple[int, int | None, dict | None]]:
        """`(id, section_id, location)` for every citation in a source — used by
        the AV section backfill to match citations into sections in Python."""
        result = await db.execute(
            select(Citation.id, Citation.section_id, Citation.location).where(
                Citation.source_id == source_id
            )
        )
        return [(row[0], row[1], row[2]) for row in result.all()]

    async def assign_section(
        self, db: AsyncSession, citation_ids: list[int], section_id: int
    ) -> None:
        """Bulk-set `section_id` on the given citations."""
        if not citation_ids:
            return
        await db.execute(
            update(Citation)
            .where(Citation.id.in_(citation_ids))
            .values(section_id=section_id, updated_at=utcnow())
        )

    async def delete_pdf_derived(self, db: AsyncSession, *, user_id: str, source_id: int) -> None:
        """Delete captures + citations derived from a previous PDF (location
        type `pdf_v1`). Captures go first since they reference the citations."""
        pdf_citation_ids = select(Citation.id).where(
            Citation.user_id == user_id,
            Citation.source_id == source_id,
            Citation.location["type"].astext == "pdf_v1",
        )
        await db.execute(
            delete(Capture).where(
                Capture.user_id == user_id,
                Capture.citation_id.in_(pdf_citation_ids),
            )
        )
        await db.execute(
            delete(Citation).where(
                Citation.user_id == user_id,
                Citation.source_id == source_id,
                Citation.location["type"].astext == "pdf_v1",
            )
        )

    async def delete_embedding(self, db: AsyncSession, citation_id: int) -> None:
        await db.execute(delete(RagEmbedding).where(RagEmbedding.citation_id == citation_id))

    async def unlink_captures(self, db: AsyncSession, citation_id: int) -> None:
        await db.execute(
            update(Capture)
            .where(Capture.citation_id == citation_id)
            .values(citation_id=None, updated_at=func.now())
        )

    async def delete_by_id(self, db: AsyncSession, citation_id: int) -> None:
        await db.execute(delete(Citation).where(Citation.id == citation_id))
