"""Citation-pivoted local graph for any node.

Polymorphic over the center node's kind. For takeaway and note centers, the
pivots are the citations the center references; the response carries other
takeaways/notes touching those same citations. For a citation center, the
citation itself acts as the only pivot; the response carries every takeaway
and note that references it.

The output shape (`NodeNeighborhood`) is identical for all three centers, so
the frontend renders the same component regardless of what the user is
viewing. No new schema beyond what `app/schemas/graph.py` already defines.

No embeddings here — this is the structural-connection view. The semantic
parallels view (where available, currently takeaway-only) is a separate
concern.
"""

from __future__ import annotations

from collections import defaultdict

from sqlalchemy import Select, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError, ValidationError
from app.core.ownership import require_citation, require_takeaway
from app.models.database import (
    NoteCitation,
    SourceTakeawayCitation,
)
from app.repositories.neighborhood_repository import NeighborhoodRepository
from app.schemas.graph import (
    GraphNode,
    NeighborhoodConnection,
    NodeNeighborhood,
    build_node_id,
    parse_node_id,
)

# Hard cap per pivot for takeaway/note centers to keep dense citations from
# exploding the graph. NOT applied to citation centers — when the user opens
# a citation directly, they're asking to see everything touching it, and
# truncating silently would lie about the connection set.
MAX_CONNECTIONS_PER_CITATION = 5


class NeighborhoodService:
    def __init__(self, repo: NeighborhoodRepository | None = None) -> None:
        self._repo = repo or NeighborhoodRepository()

    async def build(self, db: AsyncSession, *, user_id: str, node_id: str) -> NodeNeighborhood:
        try:
            kind, entity_id = parse_node_id(node_id)
        except ValueError as exc:
            raise ValidationError(str(exc)) from exc
        if kind == "takeaway":
            return await self._takeaway_center(db, user_id=user_id, takeaway_id=entity_id)
        if kind == "note":
            return await self._note_center(db, user_id=user_id, note_id=entity_id)
        return await self._citation_center(db, user_id=user_id, citation_id=entity_id)

    # ----- Takeaway center -----

    async def _takeaway_center(
        self, db: AsyncSession, *, user_id: str, takeaway_id: int
    ) -> NodeNeighborhood:
        takeaway = await require_takeaway(db, takeaway_id, user_id)
        center_source = await self._repo.fetch_source(db, takeaway.source_id)
        center = GraphNode(
            id=build_node_id("takeaway", takeaway.id),
            kind="takeaway",
            entity_id=takeaway.id,
            title=takeaway.title,
            source_id=takeaway.source_id,
            source_title=center_source.title if center_source else None,
            source_type=center_source.type if center_source else None,
        )

        citation_ids_stmt = select(SourceTakeawayCitation.citation_id).where(
            SourceTakeawayCitation.takeaway_id == takeaway_id
        )
        return await self._build_from_pivot(
            db,
            user_id=user_id,
            center=center,
            citation_ids_stmt=citation_ids_stmt,
            exclude_takeaway_id=takeaway_id,
            exclude_note_id=None,
        )

    # ----- Note center -----

    async def _note_center(
        self, db: AsyncSession, *, user_id: str, note_id: int
    ) -> NodeNeighborhood:
        row = await self._repo.fetch_note_center(db, user_id=user_id, note_id=note_id)
        if row is None:
            raise NotFoundError(f"note {note_id} not found")
        note, source_title, source_type = row
        center = GraphNode(
            id=build_node_id("note", note.id),
            kind="note",
            entity_id=note.id,
            title=note.title,
            source_id=note.source_id,
            source_title=source_title,
            source_type=source_type,
        )

        citation_ids_stmt = select(NoteCitation.citation_id).where(NoteCitation.note_id == note_id)
        return await self._build_from_pivot(
            db,
            user_id=user_id,
            center=center,
            citation_ids_stmt=citation_ids_stmt,
            exclude_takeaway_id=None,
            exclude_note_id=note_id,
        )

    # ----- Citation center -----

    async def _citation_center(
        self, db: AsyncSession, *, user_id: str, citation_id: int
    ) -> NodeNeighborhood:
        citation = await require_citation(db, citation_id, user_id)
        source = await self._repo.fetch_source(db, citation.source_id)
        center = GraphNode(
            id=build_node_id("citation", citation.id),
            kind="citation",
            entity_id=citation.id,
            # Title is unused for citation rendering (the dot has no label);
            # still populated so the type round-trips uniformly.
            title=citation.text[:80],
            source_id=citation.source_id,
            source_title=source.title if source else None,
            source_type=source.type if source else None,
            text=citation.text,
            location=citation.location,
            speaker=citation.speaker,
        )

        # When the center is a citation, the citation IS the pivot. No
        # additional pivot dots beyond the center itself, and no cap: the user
        # explicitly opened this citation, so they want to see every entity
        # touching it.
        connections = await self._fetch_connections(
            db,
            user_id=user_id,
            citation_ids=[citation_id],
            exclude_takeaway_id=None,
            exclude_note_id=None,
            cap_per_citation=None,
        )
        return NodeNeighborhood(center=center, citations=[], connections=connections)

    # ----- Pivot-driven body shared by takeaway + note centers -----

    async def _build_from_pivot(
        self,
        db: AsyncSession,
        *,
        user_id: str,
        center: GraphNode,
        citation_ids_stmt: Select[tuple[int]],
        exclude_takeaway_id: int | None,
        exclude_note_id: int | None,
    ) -> NodeNeighborhood:
        citations = await self._fetch_citation_nodes(
            db, user_id=user_id, citation_ids_stmt=citation_ids_stmt
        )
        if not citations:
            return NodeNeighborhood(center=center, citations=[], connections=[])

        citation_ids = [c.entity_id for c in citations]
        connections = await self._fetch_connections(
            db,
            user_id=user_id,
            citation_ids=citation_ids,
            exclude_takeaway_id=exclude_takeaway_id,
            exclude_note_id=exclude_note_id,
            cap_per_citation=MAX_CONNECTIONS_PER_CITATION,
        )
        return NodeNeighborhood(center=center, citations=citations, connections=connections)

    # ----- Helpers -----

    async def _fetch_citation_nodes(
        self, db: AsyncSession, *, user_id: str, citation_ids_stmt: Select[tuple[int]]
    ) -> list[GraphNode]:
        result = await self._repo.fetch_citation_nodes(
            db, user_id=user_id, citation_ids_stmt=citation_ids_stmt
        )
        return [
            GraphNode(
                id=build_node_id("citation", row.id),
                kind="citation",
                entity_id=row.id,
                title=row.text[:80],
                source_id=row.source_id,
                source_title=row.source_title,
                source_type=row.source_type,
                text=row.text,
                location=row.location,
                speaker=row.speaker,
            )
            for row in result
        ]

    async def _fetch_connections(
        self,
        db: AsyncSession,
        *,
        user_id: str,
        citation_ids: list[int],
        exclude_takeaway_id: int | None,
        exclude_note_id: int | None,
        cap_per_citation: int | None,
    ) -> list[NeighborhoodConnection]:
        # Other takeaways touching any of these citations.
        takeaway_rows = await self._repo.fetch_takeaway_connections(
            db,
            user_id=user_id,
            citation_ids=citation_ids,
            exclude_takeaway_id=exclude_takeaway_id,
        )

        # Notes touching any of these citations.
        note_rows = await self._repo.fetch_note_connections(
            db,
            user_id=user_id,
            citation_ids=citation_ids,
            exclude_note_id=exclude_note_id,
        )

        # Group via_citation_ids per (kind, entity_id) so the same entity
        # appears once even when it shares multiple citations with the center.
        nodes_by_key: dict[tuple[str, int], GraphNode] = {}
        via_by_key: dict[tuple[str, int], list[int]] = defaultdict(list)

        for row in takeaway_rows:
            key = ("takeaway", row.id)
            if key not in nodes_by_key:
                nodes_by_key[key] = GraphNode(
                    id=build_node_id("takeaway", row.id),
                    kind="takeaway",
                    entity_id=row.id,
                    title=row.title,
                    source_id=row.source_id,
                    source_title=row.source_title,
                    source_type=row.source_type,
                )
            via_by_key[key].append(row.citation_id)

        for note_row in note_rows:
            note_key = ("note", note_row.id)
            if note_key not in nodes_by_key:
                nodes_by_key[note_key] = GraphNode(
                    id=build_node_id("note", note_row.id),
                    kind="note",
                    entity_id=note_row.id,
                    title=note_row.title,
                    source_id=note_row.source_id,
                    source_title=note_row.source_title,
                    source_type=note_row.source_type,
                )
            via_by_key[note_key].append(note_row.citation_id)

        # Iterate in deterministic order — SQL rows from UNION-style fetches
        # are not ordered, so without sorting the cap-eviction outcome would
        # vary between runs. Sort by (kind, entity_id) so identical DB state
        # always produces the same neighborhood.
        connections: list[NeighborhoodConnection] = []
        per_citation_count: dict[int, int] = defaultdict(int)
        for key in sorted(nodes_by_key.keys()):
            node = nodes_by_key[key]
            via_ids = sorted(set(via_by_key[key]))
            if cap_per_citation is None:
                kept_via = via_ids
            else:
                kept_via = []
                for cid in via_ids:
                    if per_citation_count[cid] >= cap_per_citation:
                        continue
                    kept_via.append(cid)
                    per_citation_count[cid] += 1
            if not kept_via:
                continue
            connections.append(NeighborhoodConnection(node=node, via_citation_ids=kept_via))

        return connections


def neighborhood_service() -> NeighborhoodService:
    return NeighborhoodService()
