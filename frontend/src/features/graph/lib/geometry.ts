import type { SimulationLinkDatum, SimulationNodeDatum } from "d3-force";

// Shortest distance from point (px,py) to the segment (ax,ay)–(bx,by). Used
// for edge hit-testing; the standard projection-onto-segment formulation.
export function pointSegmentDistance(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) {
    const ex = px - ax;
    const ey = py - ay;
    return Math.sqrt(ex * ex + ey * ey);
  }
  let tNorm = ((px - ax) * dx + (py - ay) * dy) / len2;
  tNorm = Math.max(0, Math.min(1, tNorm));
  const cx = ax + tNorm * dx;
  const cy = ay + tNorm * dy;
  const ex = px - cx;
  const ey = py - cy;
  return Math.sqrt(ex * ex + ey * ey);
}

// d3-force rewrites link.source/target from a string id to a SimulationNodeDatum
// reference after the first tick. We always carry string ids in our data,
// so this helper unifies both shapes back to a string id.
type Endpoint = SimulationLinkDatum<SimulationNodeDatum & { id: string }>["source"];
export function linkEndpointId(endpoint: Endpoint): string {
  return typeof endpoint === "object" ? endpoint.id : String(endpoint);
}
