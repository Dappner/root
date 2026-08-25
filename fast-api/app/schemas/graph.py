"""Schemas for the knowledge graph view.

Nodes carry one of three `kind`s: takeaway, note, citation. Citation-specific
fields (`text`, `location`, `speaker`) are optional on the shared type so the
full graph and the per-takeaway neighborhood can both consume this schema
without parallel definitions.

Two edge kinds coexist:

- **Structural** edges: the endpoints share at least one citation. User-
  asserted, strong signal. `shared_citation_ids` carries the evidence.
- **Semantic** edges: nearest-neighbor in embedding space (cross-source).
  Inferred, weaker signal. `similarity` carries the cosine score.

When the same pair qualifies for both, structural wins and the semantic edge
is suppressed — see GraphService for the dedup rule.
"""

from __future__ import annotations

from typing import Any, Literal, get_args

from pydantic import BaseModel, Field, field_validator

from app.schemas.citation_location import CitationLocation
from app.schemas.citations import _coerce_location

EdgeType = Literal["structural", "semantic"]
NodeKind = Literal["takeaway", "note", "citation"]
_VALID_NODE_KINDS = frozenset(get_args(NodeKind))


def build_node_id(kind: NodeKind, entity_id: int) -> str:
    """Canonical composite id used everywhere in graph land."""
    return f"{kind}:{entity_id}"


def parse_node_id(node_id: str) -> tuple[NodeKind, int]:
    """Inverse of `build_node_id`. Raises ValueError on malformed input.

    Kept at the schema layer so any service / route consuming the node-id
    convention has a single source of truth.
    """
    kind, _, raw_id = node_id.partition(":")
    if kind not in _VALID_NODE_KINDS or not raw_id:
        raise ValueError(f"invalid node_id: {node_id!r}")
    try:
        return kind, int(raw_id)  # type: ignore[return-value]
    except ValueError as exc:
        raise ValueError(f"invalid node_id: {node_id!r}") from exc


class GraphNode(BaseModel):
    """A node in the user's knowledge graph.

    Citation-specific fields (`text`, `location`, `speaker`) are populated
    only when `kind == "citation"`. Source fields apply to all three kinds.
    """

    id: str  # composite "takeaway:42" | "note:7" | "citation:17"
    kind: NodeKind
    entity_id: int
    title: str
    source_id: int | None
    source_title: str | None
    source_type: str | None

    # Citation-only fields. Always None for takeaway / note nodes.
    text: str | None = None
    location: CitationLocation | None = None
    speaker: str | None = None

    @field_validator("location", mode="before")
    @classmethod
    def _validate_location(cls, value: Any) -> CitationLocation | None:
        return _coerce_location(value)


class GraphEdge(BaseModel):
    """An edge between two nodes.

    For structural edges, `shared_citation_ids` is populated.
    For semantic edges, `similarity` is populated.
    """

    source: str  # node id
    target: str  # node id
    edge_type: EdgeType
    shared_citation_ids: list[int] = Field(default_factory=list)
    similarity: float | None = None


class GraphResponse(BaseModel):
    nodes: list[GraphNode]
    edges: list[GraphEdge]


# ----- Node-centric neighborhood -----
# Polymorphic over node kind: works for takeaway, note, or citation centers.
# The shape is the same — pivot through citations, group connections by
# (kind, entity_id), back-reference shared citations via `via_citation_ids`.


class NeighborhoodConnection(BaseModel):
    node: GraphNode
    via_citation_ids: list[int]


class NodeNeighborhood(BaseModel):
    center: GraphNode
    citations: list[GraphNode]  # the pivots; empty when center is itself a citation
    connections: list[NeighborhoodConnection]
