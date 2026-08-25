import type { SimulationLinkDatum, SimulationNodeDatum } from "d3-force";
import type { GraphNodeDTO } from "@/features/graph/types";
import type { SourceNode } from "@/features/graph/lib/source-node";
import { linkEndpointId } from "@/features/graph/lib/geometry";

// Structural/semantic come from the API; tag + containment are synthesized
// client-side once sources join the graph.
export const EDGE_KIND = {
  Structural: "structural",
  Semantic: "semantic",
  Tag: "tag",
  Containment: "containment",
} as const;
export type EdgeKind = (typeof EDGE_KIND)[keyof typeof EDGE_KIND];

export type RenderNode = GraphNodeDTO | SourceNode;

export type SimNode = SimulationNodeDatum & {
  id: string;
  node: RenderNode;
};

export type SimLink = SimulationLinkDatum<SimNode> & {
  similarity: number;
  edge_type: EdgeKind;
  // Per-kind metadata, surfaced on edge hover. Each field is only populated
  // for the edge type it applies to.
  shared_citation_ids?: number[]; // structural
  shared_tag_ids?: number[]; // tag
};

// Returns the drawable + simulated subset of edges given current thresholds.
// Structural and containment always pass — they're structural truth, not
// similarity signals. Semantic and tag respect their respective cutoffs.
export function selectVisibleLinks(
  allLinks: SimLink[],
  containmentLinks: SimLink[],
  similarityCutoff: number,
  tagCutoff: number,
): SimLink[] {
  const visible = allLinks.filter((l) => {
    switch (l.edge_type) {
      case EDGE_KIND.Structural:
        return true;
      case EDGE_KIND.Semantic:
        return l.similarity >= similarityCutoff;
      case EDGE_KIND.Tag:
        return l.similarity >= tagCutoff;
      default:
        return false;
    }
  });
  return visible.concat(containmentLinks);
}

// Bidirectional id → neighbor ids map for hover-highlight focus rings.
export function buildAdjacency(links: SimLink[]): Map<string, Set<string>> {
  const adj = new Map<string, Set<string>>();
  for (const l of links) {
    const sId = linkEndpointId(l.source);
    const tId = linkEndpointId(l.target);
    if (!adj.has(sId)) adj.set(sId, new Set());
    if (!adj.has(tId)) adj.set(tId, new Set());
    adj.get(sId)?.add(tId);
    adj.get(tId)?.add(sId);
  }
  return adj;
}
