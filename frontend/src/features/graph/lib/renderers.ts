import type { ZoomTransform } from "d3-zoom";
import { truncate } from "@/lib/utils";
import {
  EDGE_KIND,
  type SimLink,
  type SimNode,
} from "@/features/graph/lib/edge-kinds";
import { colorForSource, colorForTag } from "@/features/graph/lib/colors";
import type { TagCluster } from "@/features/graph/lib/clusters";
import type { Theme } from "@/features/graph/lib/theme";

// Node + label sizing constants. Kept here (not in the component) because
// they're shared between the renderers and the hit-test.
export const NODE_RADIUS = 6;
export const NODE_RADIUS_HOVER = 9;
// Source donut: hollow ring, source-colored, slightly larger than an idea
// dot so it reads as "container" without competing for attention.
export const SOURCE_RADIUS_MIN = 9;
export const SOURCE_RADIUS_PER_CHILD = 1;
export const SOURCE_RING_WIDTH = 1.5;
export const LABEL_FONT = "11px ui-sans-serif, system-ui, sans-serif";
export const LABEL_MAX_CHARS = 60;

export function sourceRadius(childCount: number, hover = false): number {
  return SOURCE_RADIUS_MIN + childCount * SOURCE_RADIUS_PER_CHILD + (hover ? 2 : 0);
}

interface ClusterMetrics {
  cx: number;
  cy: number;
  radius: number;
}

// Screen-space axis-aligned bbox of a drawn cluster label, used for pointer
// hit-testing. Recomputed each frame by drawClusterLabels since label sizes
// depend on the live zoom transform.
export interface ClusterLabelHitbox {
  tagId: number;
  label: string;
  // Screen-space rect (pre-zoom-transform applied), in canvas pixels.
  x: number;
  y: number;
  width: number;
  height: number;
}

// Computed once per frame and reused by both region + label rendering.
export function computeClusterMetrics(
  clusters: TagCluster[],
  nodeById: Map<string, SimNode>,
): Map<number, ClusterMetrics> {
  const metrics = new Map<number, ClusterMetrics>();
  for (const cluster of clusters) {
    let sx = 0;
    let sy = 0;
    let n = 0;
    for (const id of cluster.memberIds) {
      const node = nodeById.get(id);
      if (!node || node.x == null || node.y == null) continue;
      sx += node.x;
      sy += node.y;
      n++;
    }
    if (n === 0) continue;
    const cx = sx / n;
    const cy = sy / n;
    let sumDist = 0;
    for (const id of cluster.memberIds) {
      const node = nodeById.get(id);
      if (!node || node.x == null || node.y == null) continue;
      const dx = node.x - cx;
      const dy = node.y - cy;
      sumDist += Math.sqrt(dx * dx + dy * dy);
    }
    // Floor of 60 so tiny clusters still read as a region not a dot.
    const radius = Math.max(60, (sumDist / n) * 1.4 + 30);
    metrics.set(cluster.tagId, { cx, cy, radius });
  }
  return metrics;
}

export function drawRegions(
  ctx: CanvasRenderingContext2D,
  clusters: TagCluster[],
  metrics: Map<number, ClusterMetrics>,
  colorById: Map<number, string>,
  isDark: boolean,
): void {
  ctx.save();
  // `lighter` adds toward white — only readable on dark bgs. `multiply`
  // darkens toward the color — readable on light bgs. Both preserve the
  // "overlapping regions blend" intuition (additive vs subtractive), just in
  // opposite directions.
  ctx.globalCompositeOperation = isDark ? "lighter" : "multiply";
  const innerAlpha = isDark ? "55" : "66";
  const midAlpha = isDark ? "10" : "20";
  for (const cluster of clusters) {
    const m = metrics.get(cluster.tagId);
    if (!m) continue;
    const color = colorById.get(cluster.tagId) ?? colorForTag(cluster.tagId);
    const grad = ctx.createRadialGradient(m.cx, m.cy, 0, m.cx, m.cy, m.radius);
    grad.addColorStop(0, `${color}${innerAlpha}`);
    grad.addColorStop(0.7, `${color}${midAlpha}`);
    grad.addColorStop(1, `${color}00`);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(m.cx, m.cy, m.radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export function drawClusterLabels(
  ctx: CanvasRenderingContext2D,
  clusters: TagCluster[],
  metrics: Map<number, ClusterMetrics>,
  theme: Theme,
  t: ZoomTransform,
  hasFocus: boolean,
  activeTagId: number | null,
  outHitboxes?: ClusterLabelHitbox[],
  colorById?: Map<number, string>,
): void {
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  if (outHitboxes) outHitboxes.length = 0;
  for (const cluster of clusters) {
    const m = metrics.get(cluster.tagId);
    if (!m) continue;
    // Font size in screen pixels; counter-scaling by t.k keeps it constant
    // across zoom levels. Sqrt(n) so big themes feel big without billboarding.
    const fontPx = Math.min(28, 12 + Math.sqrt(cluster.memberIds.length) * 2.5);
    const text = cluster.label.toUpperCase();
    const isActive = activeTagId === cluster.tagId;
    ctx.save();
    ctx.translate(m.cx, m.cy);
    ctx.scale(1 / t.k, 1 / t.k);
    ctx.font = isActive
      ? `700 ${fontPx}px ui-sans-serif, system-ui, sans-serif`
      : `600 ${fontPx}px ui-sans-serif, system-ui, sans-serif`;
    // Low alpha so labels whisper rather than shout; dim further when a node
    // is in focus so the focused subgraph dominates. The active label pops
    // to full opacity, takes its tag color, and gets a subtle stroke so it
    // reads as the current selection.
    const baseAlpha = hasFocus ? 0.06 : 0.18;
    ctx.globalAlpha = isActive ? 1 : baseAlpha;
    if (isActive) {
      const color =
        colorById?.get(cluster.tagId) ?? colorForTag(cluster.tagId);
      ctx.fillStyle = color;
      ctx.strokeStyle = theme.background;
      ctx.lineWidth = 3;
      ctx.lineJoin = "round";
      ctx.strokeText(text, 0, 0);
    } else {
      ctx.fillStyle = theme.foreground;
    }
    ctx.fillText(text, 0, 0);
    ctx.restore();

    if (outHitboxes) {
      // Measure in screen pixels (font is screen-px sized). Convert centroid
      // from graph → screen coordinates so the hitbox lives in pointer space.
      // Match the weight used to paint this label — bold glyphs are wider,
      // so measuring at 600 when we painted at 700 would underestimate.
      ctx.save();
      const weight = isActive ? 700 : 600;
      ctx.font = `${weight} ${fontPx}px ui-sans-serif, system-ui, sans-serif`;
      const measure = ctx.measureText(text);
      ctx.restore();
      const screenCx = m.cx * t.k + t.x;
      const screenCy = m.cy * t.k + t.y;
      // measureText's ascent/descent give true vertical bounds; pad a few
      // pixels so the click target is forgiving but not greedy.
      const ascent = measure.actualBoundingBoxAscent || fontPx * 0.7;
      const descent = measure.actualBoundingBoxDescent || fontPx * 0.3;
      const padX = 4;
      const padY = 2;
      const width = measure.width + padX * 2;
      const height = ascent + descent + padY * 2;
      outHitboxes.push({
        tagId: cluster.tagId,
        label: cluster.label,
        x: screenCx - width / 2,
        y: screenCy - height / 2,
        width,
        height,
      });
    }
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = "start";
}

export function drawLinks(
  ctx: CanvasRenderingContext2D,
  links: SimLink[],
  theme: Theme,
  t: ZoomTransform,
  focus: Set<string> | null,
): void {
  for (const link of links) {
    const s = link.source as SimNode;
    const tgt = link.target as SimNode;
    if (
      typeof s !== "object" ||
      typeof tgt !== "object" ||
      s.x == null ||
      s.y == null ||
      tgt.x == null ||
      tgt.y == null
    )
      continue;
    const inFocus = !focus || (focus.has(s.id) && focus.has(tgt.id));
    switch (link.edge_type) {
      case EDGE_KIND.Structural:
        ctx.strokeStyle = theme.foreground;
        ctx.globalAlpha = inFocus ? 0.8 : 0.08;
        ctx.lineWidth = 1.5 / t.k;
        ctx.setLineDash([]);
        break;
      case EDGE_KIND.Semantic:
        ctx.strokeStyle = theme.muted;
        ctx.globalAlpha = inFocus ? 0.5 : 0.08;
        ctx.lineWidth = 1 / t.k;
        ctx.setLineDash([4 / t.k, 4 / t.k]);
        break;
      case EDGE_KIND.Tag:
        ctx.strokeStyle = theme.muted;
        ctx.globalAlpha = inFocus ? 0.6 : 0.06;
        ctx.lineWidth = 1.2 / t.k;
        ctx.setLineDash([1 / t.k, 3 / t.k]);
        break;
      case EDGE_KIND.Containment: {
        // The source endpoint carries the color since all its takeaways share
        // it; if a non-source is at .source, fall back to the other end so
        // the line still picks up a meaningful hue.
        const sourceColor =
          s.node.kind === "source"
            ? colorForSource(s.node.source_id)
            : colorForSource(tgt.node.source_id);
        ctx.strokeStyle = sourceColor;
        ctx.globalAlpha = inFocus ? 0.45 : 0.15;
        ctx.lineWidth = 1 / t.k;
        ctx.setLineDash([]);
        break;
      }
      default:
        continue;
    }
    ctx.beginPath();
    ctx.moveTo(s.x, s.y);
    ctx.lineTo(tgt.x, tgt.y);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;
}

export function drawNodes(
  ctx: CanvasRenderingContext2D,
  nodes: SimNode[],
  theme: Theme,
  t: ZoomTransform,
  focus: Set<string> | null,
  hoverId: string | null,
): void {
  for (const n of nodes) {
    if (n.x == null || n.y == null) continue;
    const isHover = n.id === hoverId;
    const inFocus = !focus || focus.has(n.id);
    const color = colorForSource(n.node.source_id);
    ctx.globalAlpha = inFocus ? 1 : 0.2;

    if (n.node.kind === "source") {
      // Hollow ring — same circular family as ideas, but the missing fill
      // marks them as a different category (container, not idea).
      const radius = sourceRadius(n.node.childCount, isHover);
      ctx.strokeStyle = color;
      ctx.lineWidth = SOURCE_RING_WIDTH / t.k;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc(n.x, n.y, radius, 0, Math.PI * 2);
      ctx.stroke();
      continue;
    }

    const r = isHover ? NODE_RADIUS_HOVER : NODE_RADIUS;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
    ctx.fill();

    if (n.node.kind === "note") {
      ctx.strokeStyle = theme.card;
      ctx.lineWidth = 2 / t.k;
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
}

// Pulse ring drawn over a node when something off-canvas (the sidebar) is
// pointing at it. Uses a time-driven sine so the ring breathes; counter-scaled
// so the ring stays a consistent screen-pixel size at any zoom.
export function drawHighlightRing(
  ctx: CanvasRenderingContext2D,
  node: SimNode,
  t: ZoomTransform,
  phase: number,
): void {
  const nx = node.x;
  const ny = node.y;
  if (nx == null || ny == null) return;
  const color = colorForSource(node.node.source_id);
  const baseScreenRadius =
    node.node.kind === "source"
      ? sourceRadius(node.node.childCount) * t.k
      : NODE_RADIUS_HOVER;
  // Sine in [0,1]; expand the ring outward and fade as it grows.
  const pulse = (Math.sin(phase * Math.PI * 2) + 1) / 2;
  const ringScreenRadius = baseScreenRadius + 6 + pulse * 10;
  const ringRadius = ringScreenRadius / t.k;
  const alpha = 0.55 - pulse * 0.35;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2 / t.k;
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.arc(nx, ny, ringRadius, 0, Math.PI * 2);
  ctx.stroke();
  // Solid inner ring so the node clearly reads as "the one" even at the dim
  // phase of the pulse.
  ctx.globalAlpha = 0.9;
  ctx.lineWidth = 1.5 / t.k;
  ctx.beginPath();
  ctx.arc(nx, ny, (baseScreenRadius + 3) / t.k, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

export function drawHoverLabel(
  ctx: CanvasRenderingContext2D,
  hovered: SimNode,
  theme: Theme,
  t: ZoomTransform,
): void {
  if (hovered.x == null || hovered.y == null) return;
  const title = truncate(hovered.node.title ?? "", LABEL_MAX_CHARS);
  if (!title) return;
  ctx.font = LABEL_FONT;
  ctx.textBaseline = "middle";
  // Counter-scale so the label is screen-pixel sized at any zoom.
  ctx.save();
  ctx.translate(hovered.x, hovered.y);
  ctx.scale(1 / t.k, 1 / t.k);
  const metrics = ctx.measureText(title);
  const padX = 6;
  const padY = 3;
  const w = metrics.width + padX * 2;
  const h = 18;
  // Offset above the node (above the source ring for sources).
  const nodeScreenRadius =
    hovered.node.kind === "source"
      ? sourceRadius(hovered.node.childCount) * t.k
      : NODE_RADIUS_HOVER;
  const offsetY = -(nodeScreenRadius + h / 2 + 6);
  ctx.fillStyle = theme.background;
  ctx.globalAlpha = 0.92;
  ctx.fillRect(-w / 2, offsetY - h / 2, w, h);
  ctx.globalAlpha = 1;
  ctx.strokeStyle = theme.muted;
  ctx.lineWidth = 1;
  ctx.setLineDash([]);
  ctx.strokeRect(-w / 2, offsetY - h / 2, w, h);
  ctx.fillStyle = theme.foreground;
  ctx.textAlign = "center";
  ctx.fillText(title, 0, offsetY + padY - 2);
  ctx.textAlign = "start";
  ctx.restore();
}
