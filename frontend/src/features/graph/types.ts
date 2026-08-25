// Type facade for the graph feature — only file in this module that imports
// from @/features/rag/rag-api.generated.

import type {
  GraphEdge as ApiGraphEdge,
  GraphNode as ApiGraphNode,
  GraphResponse as ApiGraphResponse,
  NeighborhoodConnection as ApiNeighborhoodConnection,
  NodeNeighborhood as ApiNodeNeighborhood,
} from "@/features/rag/rag-api.generated";

export type GraphNodeDTO = ApiGraphNode;
export type GraphEdgeDTO = ApiGraphEdge;
export type GraphResponseDTO = ApiGraphResponse;
export type NeighborhoodConnectionDTO = ApiNeighborhoodConnection;
export type NodeNeighborhoodDTO = ApiNodeNeighborhood;

// Composite node ID format used throughout graph land: "takeaway:42",
// "note:7", "citation:17". Keeps frontend deduplication straightforward and
// mirrors the backend's same convention.
export type NodeKind = "takeaway" | "note" | "citation";
export function buildNodeId(kind: NodeKind, entityId: number): string {
  return `${kind}:${entityId}`;
}
