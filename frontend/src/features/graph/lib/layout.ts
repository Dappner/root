// Shared d3-force layout helper. Both the full graph and the per-takeaway
// mini-graph derive node positions the same way; only the simulation
// parameters differ. Callers pass a `params` object that controls the visual
// scale.

import type { GraphEdgeDTO, GraphNodeDTO } from "@/features/graph/types";
import {
  type SimulationLinkDatum,
  type SimulationNodeDatum,
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
} from "d3-force";

export interface ForceParams {
  /** Half-diagonal of the rendered node + slack. */
  collideRadius: number;
  /** Base rest length for links; per-edge value is scaled by similarity. */
  baseLinkDistance: number;
  /** Many-body charge; more negative pushes nodes apart harder. */
  chargeStrength: number;
  /** How many ticks before reading positions. */
  ticks: number;
  /**
   * Optional: pin this node at the origin. Useful for ego-graph views where
   * the user expects the "current" node to sit visually central instead of
   * drifting to wherever the simulation settles it.
   */
  pinnedNodeId?: string;
}

export type LaidOutNode = GraphNodeDTO & { x: number; y: number };

export function runForceLayout(
  nodes: GraphNodeDTO[],
  edges: GraphEdgeDTO[],
  params: ForceParams,
): LaidOutNode[] {
  if (nodes.length === 0) return [];

  // d3-force mutates the input objects; carry the full GraphNodeDTO through
  // the sim node so we can read it back unchanged after layout.
  // `fx`/`fy` pin a node in place when set (d3-force convention).
  type SimNode = SimulationNodeDatum & {
    id: string;
    node: GraphNodeDTO;
    fx?: number;
    fy?: number;
  };
  type SimLink = SimulationLinkDatum<SimNode> & { similarity: number };
  const simNodes: SimNode[] = nodes.map((n) => {
    const pinned = n.id === params.pinnedNodeId;
    return {
      id: n.id,
      node: n,
      ...(pinned ? { fx: 0, fy: 0 } : {}),
    };
  });
  const simLinks: SimLink[] = edges.map((e) => ({
    source: e.source,
    target: e.target,
    // Structural edges are the strongest signal — treat them as max
    // similarity for layout purposes so they pull tightly. Semantic edges
    // get their actual cosine score (typically 0.4–0.7 in this corpus).
    similarity: e.edge_type === "structural" ? 1.0 : (e.similarity ?? 0.5),
  }));

  const simulation = forceSimulation<SimNode>(simNodes)
    .force(
      "link",
      forceLink<SimNode, SimLink>(simLinks)
        .id((d) => d.id)
        // Higher similarity → shorter rest length. Floor of 0.5 keeps weak
        // edges from ballooning past the canvas.
        .distance(
          (link) =>
            params.baseLinkDistance * (1.2 - Math.max(0.5, link.similarity)),
        )
        .strength((link) => Math.max(0.1, link.similarity)),
    )
    .force("charge", forceManyBody<SimNode>().strength(params.chargeStrength))
    .force("center", forceCenter(0, 0))
    .force("collide", forceCollide<SimNode>(params.collideRadius).strength(0.9))
    .stop();

  for (let i = 0; i < params.ticks; i++) simulation.tick();
  simulation.stop();

  return simNodes.map((n) => ({
    ...n.node,
    x: n.x ?? 0,
    y: n.y ?? 0,
  }));
}
