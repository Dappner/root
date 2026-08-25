"""Build a user's knowledge graph from shared-citation joins + semantic
nearest-neighbor inference.

Two edge kinds (see Root - Graph Model in the vault):

- **Structural**: endpoints share at least one citation. User-asserted.
- **Semantic**: takeaway embeddings within top-K of each other, cross-source.
  Notes don't have embeddings yet (TODO: see vault notes), so they only get
  structural edges for now.

When a pair qualifies for both, structural wins and the semantic duplicate is
suppressed.

All work is in-process Python; per-user counts are tiny. The semantic step is
N ANN queries (one per takeaway) run sequentially through the request's
session — at ~hundreds of takeaways this is fine, beyond ~1k revisit with
batched SQL.
"""

from __future__ import annotations

from collections import defaultdict
from itertools import combinations

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.cache_decorator import cached
from app.repositories.graph_repository import GraphRepository
from app.schemas.graph import GraphEdge, GraphNode, GraphResponse, build_node_id
from app.services.graph_cache import GRAPH_CACHE_TTL_SECONDS, graph_cache_key

# Each takeaway draws at most this many semantic edges out to cross-source
# neighbors. Matches the parallels panel default to keep edge density bounded
# and the graph readable. Each pair appears at most once across all nodes'
# top-K because edges are unordered.
SEMANTIC_TOP_K_PER_NODE = 3


def _edge_key(a: str, b: str) -> tuple[str, str]:
    """Canonical unordered pair: smaller id first."""
    return (a, b) if a < b else (b, a)


class GraphService:
    def __init__(self, repo: GraphRepository | None = None) -> None:
        self._repo = repo or GraphRepository()

    async def build_graph(self, db: AsyncSession, *, user_id: str) -> GraphResponse:
        # TTL-cached (60s). The build is heavy — one ANN query per takeaway —
        # and the graph tolerates brief staleness. See graph_cache.py. The
        # cache wrapper is a module-level function because @cached forbids
        # positional args and a bound method would pass `self` positionally.
        return await _build_graph_cached(service=self, db=db, user_id=user_id)

    async def _build_graph(self, db: AsyncSession, *, user_id: str) -> GraphResponse:
        nodes = await self._fetch_nodes(db, user_id=user_id)
        node_index = {n.id: n for n in nodes}

        structural = await self._fetch_structural_edges(db, user_id=user_id, node_index=node_index)
        structural_pairs = {_edge_key(e.source, e.target) for e in structural}

        semantic = await self._fetch_semantic_edges(
            db,
            user_id=user_id,
            node_index=node_index,
            skip_pairs=structural_pairs,
        )

        return GraphResponse(nodes=nodes, edges=structural + semantic)

    async def _fetch_nodes(self, db: AsyncSession, *, user_id: str) -> list[GraphNode]:
        # Takeaways always have a source (NOT NULL in schema), so the join is
        # safe. Notes may have a NULL source_id (global notes), so outer join.
        # Order both queries so downstream loops (which dict-insert by row
        # order) produce stable output across requests.
        takeaway_rows = await self._repo.fetch_takeaway_nodes(db, user_id=user_id)
        nodes: list[GraphNode] = [
            GraphNode(
                id=build_node_id("takeaway", row.id),
                kind="takeaway",
                entity_id=row.id,
                title=row.title,
                source_id=row.source_id,
                source_title=row.source_title,
                source_type=row.source_type,
            )
            for row in takeaway_rows
        ]

        note_rows = await self._repo.fetch_note_nodes(db, user_id=user_id)
        nodes.extend(
            GraphNode(
                id=build_node_id("note", row.id),
                kind="note",
                entity_id=row.id,
                title=row.title,
                source_id=row.source_id,
                source_title=row.source_title,
                source_type=row.source_type,
            )
            for row in note_rows
        )
        return nodes

    async def _fetch_structural_edges(
        self,
        db: AsyncSession,
        *,
        user_id: str,
        node_index: dict[str, GraphNode],
    ) -> list[GraphEdge]:
        # Pull every (node_id, citation_id) pair for this user via UNION ALL —
        # one query for both kinds. Filtering on user_id at this level (rather
        # than relying on the citation's ownership) keeps the result set tied
        # to entities we've already collected as nodes.
        rows = await self._repo.fetch_structural_pairs(db, user_id=user_id)

        # Bucket node ids by citation; then emit one edge per unordered pair
        # per citation, aggregating shared citation IDs across pairs.
        nodes_by_citation: dict[int, set[str]] = defaultdict(set)
        for row in rows:
            node_id = build_node_id(row.kind, row.entity_id)
            if node_id in node_index:
                nodes_by_citation[row.citation_id].add(node_id)

        edge_shared: dict[tuple[str, str], list[int]] = defaultdict(list)
        for citation_id, node_ids in nodes_by_citation.items():
            if len(node_ids) < 2:
                continue
            for a, b in combinations(sorted(node_ids), 2):
                edge_shared[(a, b)].append(citation_id)

        # Sort citation ids per edge and edges by (a, b) so identical DB state
        # produces identical JSON — keeps the frontend layout cache stable and
        # makes responses cache-friendly upstream.
        return [
            GraphEdge(
                source=a,
                target=b,
                edge_type="structural",
                shared_citation_ids=sorted(set(cids)),
            )
            for (a, b), cids in sorted(edge_shared.items())
        ]

    async def _fetch_semantic_edges(
        self,
        db: AsyncSession,
        *,
        user_id: str,
        node_index: dict[str, GraphNode],
        skip_pairs: set[tuple[str, str]],
    ) -> list[GraphEdge]:
        # Notes don't have embeddings yet — only takeaways participate in
        # semantic edges for now. When NoteEmbeddingService lands, extend the
        # candidate set to include notes.
        takeaway_nodes = [n for n in node_index.values() if n.kind == "takeaway"]
        if not takeaway_nodes:
            return []

        # One ANN query per takeaway, run sequentially. Async sessions
        # serialize at the connection level, so gather() across the same
        # session can race and raise "operation in progress" errors. Running
        # in order is honest and at current scale (dozens of takeaways) the
        # latency cost is sub-second.
        per_node_results: list[list[tuple[str, float]]] = []
        for n in takeaway_nodes:
            per_node_results.append(await self._top_k_neighbors(db, user_id=user_id, node=n))

        # Aggregate into unordered edges. Same pair seen from both endpoints
        # contributes its max similarity. Pairs already structural are dropped.
        best_sim: dict[tuple[str, str], float] = {}
        for node, neighbors in zip(takeaway_nodes, per_node_results, strict=True):
            for neighbor_id, similarity in neighbors:
                if neighbor_id not in node_index:
                    continue
                key = _edge_key(node.id, neighbor_id)
                if key in skip_pairs:
                    continue
                prior = best_sim.get(key)
                if prior is None or similarity > prior:
                    best_sim[key] = similarity

        return [
            GraphEdge(
                source=a,
                target=b,
                edge_type="semantic",
                similarity=sim,
            )
            for (a, b), sim in sorted(best_sim.items())
        ]

    async def _top_k_neighbors(
        self,
        db: AsyncSession,
        *,
        user_id: str,
        node: GraphNode,
    ) -> list[tuple[str, float]]:
        # Mirrors the parallels query: cross-source, exclude self, sha-gated
        # target fetch. Different from parallels in that there's no similarity
        # floor — the graph wants every edge that exists, and the UI labels
        # each one with its score so the user can judge.
        target = await self._repo.fetch_target_embedding(db, takeaway_id=node.entity_id)
        if target is None:
            return []
        target_embedding = target[0]

        rows = await self._repo.fetch_top_k_neighbors(
            db,
            user_id=user_id,
            target_embedding=target_embedding,
            exclude_takeaway_id=node.entity_id,
            exclude_source_id=node.source_id,
            limit=SEMANTIC_TOP_K_PER_NODE,
        )
        return [(build_node_id("takeaway", row.takeaway_id), float(row.similarity)) for row in rows]


@cached(
    key=graph_cache_key,
    ttl=GRAPH_CACHE_TTL_SECONDS,
    model=GraphResponse,
)
async def _build_graph_cached(
    *, service: GraphService, db: AsyncSession, user_id: str
) -> GraphResponse:
    # `service` and `db` are operational args absorbed by graph_cache_key's
    # **_; only user_id contributes to the cache key.
    return await service._build_graph(db, user_id=user_id)


def graph_service() -> GraphService:
    return GraphService()
