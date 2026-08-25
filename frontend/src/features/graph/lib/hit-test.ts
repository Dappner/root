import type { ZoomTransform } from "d3-zoom";
import type { SimLink, SimNode } from "@/features/graph/lib/edge-kinds";
import { EDGE_KIND } from "@/features/graph/lib/edge-kinds";
import { pointSegmentDistance } from "@/features/graph/lib/geometry";
import {
  NODE_RADIUS_HOVER,
  sourceRadius,
  type ClusterLabelHitbox,
} from "@/features/graph/lib/renderers";

// Hit radius in *screen* pixels so things stay clickable at any zoom.
const NODE_HIT_PX = NODE_RADIUS_HOVER + 4;
const EDGE_HIT_PX = 6;

// Picks the closest node within hit radius. Sources widen their effective
// radius to cover their full disc so clicks inside the empty ring still land.
export function pickNode(
  simNodes: SimNode[],
  t: ZoomTransform,
  px: number,
  py: number,
): SimNode | null {
  const x = (px - t.x) / t.k;
  const y = (py - t.y) / t.k;
  const baseHitR = NODE_HIT_PX / t.k;
  let best: SimNode | null = null;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const n of simNodes) {
    if (n.x == null || n.y == null) continue;
    const dx = n.x - x;
    const dy = n.y - y;
    const d = Math.sqrt(dx * dx + dy * dy);
    const localHitR =
      n.node.kind === "source"
        ? sourceRadius(n.node.childCount) + 4 / t.k
        : baseHitR;
    if (d < localHitR && d < bestDist) {
      bestDist = d;
      best = n;
    }
  }
  return best;
}

// Hit-tests cluster label hitboxes in screen-pixel space. Returns the topmost
// match (later entries draw on top so we walk from the end).
export function pickClusterLabel(
  hitboxes: ClusterLabelHitbox[],
  px: number,
  py: number,
): ClusterLabelHitbox | null {
  for (let i = hitboxes.length - 1; i >= 0; i--) {
    const h = hitboxes[i];
    if (
      px >= h.x &&
      px <= h.x + h.width &&
      py >= h.y &&
      py <= h.y + h.height
    ) {
      return h;
    }
  }
  return null;
}

// Shortest distance from cursor to any drawn edge segment. Containment edges
// are skipped — they're structural anchoring, not something the user needs an
// explanation for.
export function pickEdge(
  links: SimLink[],
  t: ZoomTransform,
  px: number,
  py: number,
): SimLink | null {
  const x = (px - t.x) / t.k;
  const y = (py - t.y) / t.k;
  const hitR = EDGE_HIT_PX / t.k;
  let best: SimLink | null = null;
  let bestDist = hitR;
  for (const link of links) {
    if (link.edge_type === EDGE_KIND.Containment) continue;
    const s = link.source as SimNode;
    const tg = link.target as SimNode;
    if (
      typeof s !== "object" ||
      typeof tg !== "object" ||
      s.x == null ||
      s.y == null ||
      tg.x == null ||
      tg.y == null
    )
      continue;
    const d = pointSegmentDistance(x, y, s.x, s.y, tg.x, tg.y);
    if (d < bestDist) {
      bestDist = d;
      best = link;
    }
  }
  return best;
}
