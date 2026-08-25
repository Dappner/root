import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { drag as d3drag } from "d3-drag";
import {
  forceCenter,
  forceCollide,
  forceLink,
  type ForceLink,
  forceManyBody,
  forceSimulation,
  type Simulation,
} from "d3-force";
import { select } from "d3-selection";
import { zoom as d3zoom, zoomIdentity, type ZoomTransform } from "d3-zoom";

import {
  buildAdjacency,
  selectVisibleLinks,
  type SimLink,
  type SimNode,
} from "@/features/graph/lib/edge-kinds";
import {
  applyGraphDragPosition,
  canvasToGraphPoint,
  createGraphDragSubject,
  type GraphDragSubject,
} from "@/features/graph/lib/drag-coordinates";
import { EDGE_KIND } from "@/features/graph/lib/edge-kinds";
import { pickClusterLabel, pickEdge, pickNode } from "@/features/graph/lib/hit-test";
import {
  computeClusterMetrics,
  drawClusterLabels,
  drawHighlightRing,
  drawHoverLabel,
  drawLinks,
  drawNodes,
  drawRegions,
  NODE_RADIUS,
  type ClusterLabelHitbox,
} from "@/features/graph/lib/renderers";
import { readTheme, type Theme } from "@/features/graph/lib/theme";
import type { TagCluster } from "@/features/graph/lib/clusters";
import type { EdgeTooltipState } from "@/features/graph/components/edge-tooltip";

const DPR_CAP = 2;
// Tooltip re-renders are state changes — guard against per-pixel cursor moves
// or stale-position updates within the same edge.
const TOOLTIP_MOVE_THRESHOLD = 4;
const DRAG_REHEAT_THRESHOLD_PX = 2;

const PAN_DURATION_MS = 350;
const PULSE_PERIOD_MS = 1400;

// Eases a value through a cubic ease-out: brisk start, gentle settle.
function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

interface PanAnimation {
  cancel: () => void;
}

// Animate the d3-zoom transform so a graph-space point lands at the viewport
// center, preserving current zoom (k). Returns a handle so the caller can
// cancel mid-flight. Drives through zoomBehavior.transform so d3-zoom's
// internal state stays in sync — otherwise the next user wheel/pan would
// snap back to the pre-animation transform.
function animatePanToGraphPoint(args: {
  selection: ReturnType<typeof select<HTMLCanvasElement, unknown>>;
  zoomBehavior: ReturnType<typeof d3zoom<HTMLCanvasElement, unknown>>;
  start: ZoomTransform;
  graphX: number;
  graphY: number;
  viewportWidth: number;
  viewportHeight: number;
  durationMs: number;
  isCancelled: () => boolean;
}): PanAnimation {
  const {
    selection,
    zoomBehavior,
    start,
    graphX,
    graphY,
    viewportWidth,
    viewportHeight,
    durationMs,
    isCancelled,
  } = args;

  const k = start.k;
  const targetX = viewportWidth / 2 - graphX * k;
  const targetY = viewportHeight / 2 - graphY * k;
  const dx = targetX - start.x;
  const dy = targetY - start.y;

  let raf: number | null = null;
  // Skip the animation if we're already centered — avoids a sub-pixel twitch.
  if (Math.hypot(dx, dy) < 1) {
    return { cancel: () => {} };
  }

  const startTime = performance.now();
  const tick = () => {
    if (isCancelled()) {
      raf = null;
      return;
    }
    const t = Math.min(1, (performance.now() - startTime) / durationMs);
    const e = easeOutCubic(t);
    const next = zoomIdentity
      .translate(start.x + dx * e, start.y + dy * e)
      .scale(k);
    selection.call(zoomBehavior.transform, next);
    raf = t < 1 ? requestAnimationFrame(tick) : null;
  };
  raf = requestAnimationFrame(tick);

  return {
    cancel: () => {
      if (raf != null) {
        cancelAnimationFrame(raf);
        raf = null;
      }
    },
  };
}

function hasClientPoint(
  event: Event,
): event is Event & { clientX: number; clientY: number } {
  const candidate = event as Partial<{ clientX: unknown; clientY: unknown }>;
  return (
    typeof candidate.clientX === "number" &&
    typeof candidate.clientY === "number"
  );
}

function clientPointFromEvent(event: Event): { x: number; y: number } | null {
  if (hasClientPoint(event)) {
    return { x: event.clientX, y: event.clientY };
  }

  const touchEvent = event as Partial<{
    touches: TouchList;
    changedTouches: TouchList;
  }>;

  if (touchEvent.touches && touchEvent.touches.length > 0) {
    const touch = touchEvent.touches[0];
    return { x: touch.clientX, y: touch.clientY };
  }

  if (touchEvent.changedTouches && touchEvent.changedTouches.length > 0) {
    const touch = touchEvent.changedTouches[0];
    return { x: touch.clientX, y: touch.clientY };
  }

  return null;
}

interface CanvasSimulationParams {
  containerRef: RefObject<HTMLDivElement | null>;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  simNodes: SimNode[];
  allLinks: SimLink[];
  containmentLinks: SimLink[];
  threshold: number;
  tagThreshold: number;
  clusters: TagCluster[];
  tagColorById: Map<number, string>;
  showClusters: boolean;
  showRegions: boolean;
  isDark: boolean;
  selectedNodeId: string | null;
  focusedTagId: number | null;
  onNodeSelect: (node: SimNode | null) => void;
  onClusterSelect: (tagId: number) => void;
}

interface CanvasSimulationResult {
  edgeTooltip: EdgeTooltipState | null;
  hoverCursor: boolean;
  // Highlight a graph node from off-canvas (e.g. on hover in a sidebar list).
  // Pulses a ring around the node and smoothly pans the viewport so the node
  // ends up centered (zoom level preserved). Pass null to clear.
  highlightNode: (nodeId: string | null) => void;
}

export function useCanvasSimulation(
  params: CanvasSimulationParams,
): CanvasSimulationResult {
  const {
    containerRef,
    canvasRef,
    simNodes,
    allLinks,
    containmentLinks,
    threshold,
    tagThreshold,
    clusters,
    tagColorById,
    showClusters,
    showRegions,
    isDark,
    selectedNodeId,
    focusedTagId,
    onNodeSelect,
    onClusterSelect,
  } = params;

  const [edgeTooltip, setEdgeTooltip] = useState<EdgeTooltipState | null>(null);
  const [hoverCursor, setHoverCursor] = useState(false);

  // Refs that the render loop reads each frame. State writes drive React
  // re-renders; refs avoid re-binding the heavy simulation effect.
  const transformRef = useRef<ZoomTransform>(zoomIdentity);
  const hoverIdRef = useRef<string | null>(null);
  const simRef = useRef<Simulation<SimNode, SimLink> | null>(null);
  const linkForceRef = useRef<ForceLink<SimNode, SimLink> | null>(null);
  const visibleLinksRef = useRef<SimLink[]>([]);
  const adjacencyRef = useRef<Map<string, Set<string>>>(new Map());
  const drawRef = useRef<(() => void) | null>(null);
  // Cluster + render-toggle refs, read fresh each draw. Sim never restarts
  // for these — they're render-only.
  const clustersRef = useRef<TagCluster[]>(clusters);
  const showClustersRef = useRef(showClusters);
  const showRegionsRef = useRef(showRegions);
  const tagColorByIdRef = useRef<Map<number, string>>(tagColorById);
  // SimNode lookup by id, refreshed when simNodes change.
  const nodeByIdRef = useRef<Map<string, SimNode>>(new Map());
  const selectedNodeIdRef = useRef<string | null>(selectedNodeId);
  const focusedTagIdRef = useRef<number | null>(focusedTagId);
  const onNodeSelectRef = useRef(onNodeSelect);
  const onClusterSelectRef = useRef(onClusterSelect);
  // Per-frame cluster label hitboxes (screen-space). Mutated by the renderer;
  // read by pointer handlers. Re-using one array avoids per-frame allocs.
  const clusterHitboxesRef = useRef<ClusterLabelHitbox[]>([]);
  const hoveredClusterTagIdRef = useRef<number | null>(null);
  const sizeRef = useRef({ width: 0, height: 0 });
  // Off-canvas highlight (sidebar hover → graph node). Separate from the
  // canvas-local hover ref so a node label tooltip doesn't fight with the
  // pulse and so the pulse persists even when the cursor isn't over the canvas.
  const highlightIdRef = useRef<string | null>(null);
  const pulseStartRef = useRef<number>(0);
  const pulseRafRef = useRef<number | null>(null);
  // Pan animation state. The zoom behavior and canvas selection are captured
  // by the main effect so the highlightNode callback can drive transforms
  // through them (keeping d3-zoom's internal state in sync).
  const zoomBehaviorRef = useRef<ReturnType<
    typeof d3zoom<HTMLCanvasElement, unknown>
  > | null>(null);
  const canvasSelectionRef = useRef<ReturnType<typeof select<HTMLCanvasElement, unknown>> | null>(
    null,
  );
  const panAnimationRef = useRef<PanAnimation | null>(null);
  const themeRef = useRef<Theme>({
    background: "#ffffff",
    foreground: "#0a0a0a",
    muted: "#71717a",
    card: "#ffffff",
  });

  // Sync render-only refs and request a redraw — no sim restart needed.
  useEffect(() => {
    clustersRef.current = clusters;
    showClustersRef.current = showClusters;
    showRegionsRef.current = showRegions;
    tagColorByIdRef.current = tagColorById;
    const m = new Map<string, SimNode>();
    for (const n of simNodes) m.set(n.id, n);
    nodeByIdRef.current = m;
    drawRef.current?.();
  }, [clusters, showClusters, showRegions, tagColorById, simNodes]);

  useEffect(() => {
    selectedNodeIdRef.current = selectedNodeId;
    drawRef.current?.();
  }, [selectedNodeId]);

  useEffect(() => {
    focusedTagIdRef.current = focusedTagId;
    drawRef.current?.();
  }, [focusedTagId]);

  useEffect(() => {
    onNodeSelectRef.current = onNodeSelect;
  }, [onNodeSelect]);

  useEffect(() => {
    onClusterSelectRef.current = onClusterSelect;
  }, [onClusterSelect]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const frame = requestAnimationFrame(() => {
      themeRef.current = readTheme(container, isDark);
      drawRef.current?.();
    });

    return () => cancelAnimationFrame(frame);
  }, [containerRef, isDark]);

  // Main simulation lifecycle: mount canvas + sim, install interactions.
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;
    if (simNodes.length === 0) return;

    themeRef.current = readTheme(container, isDark);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      const rect = container.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP);
      sizeRef.current = { width: rect.width, height: rect.height };
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sim.force("center", forceCenter(rect.width / 2, rect.height / 2));
      sim.alpha(0.3).restart();
    };

    const initialVisible = selectVisibleLinks(
      allLinks,
      containmentLinks,
      threshold,
      tagThreshold,
    );
    visibleLinksRef.current = initialVisible;
    adjacencyRef.current = buildAdjacency(initialVisible);

    const linkForce = forceLink<SimNode, SimLink>(initialVisible)
      .id((d) => d.id)
      .distance((l) => {
        // Containment is short so a source nests inside its takeaways; tag
        // edges sit farther apart so cross-source themes form an outer ring.
        if (l.edge_type === EDGE_KIND.Containment) return 40;
        const base = l.edge_type === EDGE_KIND.Tag ? 140 : 90;
        return base * (1.2 - Math.max(0.5, l.similarity));
      })
      .strength((l) => {
        if (l.edge_type === EDGE_KIND.Containment) return 0.5;
        if (l.edge_type === EDGE_KIND.Tag)
          return 0.3 * Math.max(0.1, l.similarity);
        return Math.max(0.1, l.similarity);
      });
    linkForceRef.current = linkForce;

    const sim = forceSimulation<SimNode>(simNodes)
      .force("link", linkForce)
      .force("charge", forceManyBody<SimNode>().strength(-220))
      .force("collide", forceCollide<SimNode>(NODE_RADIUS + 4).strength(0.9))
      .force("center", forceCenter(0, 0))
      .alphaDecay(0.025);
    simRef.current = sim;

    const draw = () => {
      const { width, height } = sizeRef.current;
      const t = transformRef.current;
      const theme = themeRef.current;
      const hoverId = hoverIdRef.current;
      const activeId = hoverId ?? selectedNodeIdRef.current;

      ctx.save();
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = theme.background;
      ctx.fillRect(0, 0, width, height);
      ctx.translate(t.x, t.y);
      ctx.scale(t.k, t.k);

      // Focus set computed first so cluster labels can dim alongside nodes
      // when a node is hovered. A node hover/select takes priority over a
      // sticky tag focus so per-node exploration still works while the tag
      // sheet is open.
      const adj = adjacencyRef.current;
      let focus: Set<string> | null = null;
      if (activeId) {
        focus = new Set<string>([activeId, ...(adj.get(activeId) ?? [])]);
      } else if (focusedTagIdRef.current != null) {
        const cluster = clustersRef.current.find(
          (c) => c.tagId === focusedTagIdRef.current,
        );
        if (cluster) {
          // Source nodes live under "source:<id>" ids and aren't in
          // memberIds (which only carries takeaways/notes), so add them
          // explicitly — otherwise the source rings dim while their
          // children stay lit.
          focus = new Set<string>(cluster.memberIds);
          for (const sid of cluster.sourceIds) focus.add(`source:${sid}`);
        }
      }

      const showR = showRegionsRef.current;
      const showC = showClustersRef.current;
      const metrics =
        showR || showC
          ? computeClusterMetrics(clustersRef.current, nodeByIdRef.current)
          : new Map();
      if (showR) {
        drawRegions(
          ctx,
          clustersRef.current,
          metrics,
          tagColorByIdRef.current,
          isDark,
        );
      }
      if (showC) {
        // Hover takes priority over the sticky selection so users can preview
        // other clusters without losing the active highlight visually.
        const activeClusterTagId =
          hoveredClusterTagIdRef.current ?? focusedTagIdRef.current;
        drawClusterLabels(
          ctx,
          clustersRef.current,
          metrics,
          theme,
          t,
          !!focus,
          activeClusterTagId,
          clusterHitboxesRef.current,
          tagColorByIdRef.current,
        );
      } else {
        // Clusters hidden — clear any stale hitboxes so the cursor doesn't
        // appear clickable over invisible labels.
        clusterHitboxesRef.current.length = 0;
      }
      drawLinks(ctx, visibleLinksRef.current, theme, t, focus);
      drawNodes(ctx, simNodes, theme, t, focus, activeId);
      if (activeId) {
        const hovered = nodeByIdRef.current.get(activeId);
        if (hovered) drawHoverLabel(ctx, hovered, theme, t);
      }
      const highlightId = highlightIdRef.current;
      if (highlightId) {
        const highlighted = nodeByIdRef.current.get(highlightId);
        if (highlighted) {
          const elapsed = performance.now() - pulseStartRef.current;
          const phase = (elapsed % PULSE_PERIOD_MS) / PULSE_PERIOD_MS;
          drawHighlightRing(ctx, highlighted, t, phase);
        }
      }
      ctx.restore();
    };

    sim.on("tick", draw);
    drawRef.current = draw;

    const onPointerMove = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const px = event.clientX - rect.left;
      const py = event.clientY - rect.top;
      const t = transformRef.current;
      const node = pickNode(simNodes, t, px, py);
      const newId = node?.id ?? null;
      if (newId !== hoverIdRef.current) {
        hoverIdRef.current = newId;
        draw();
      }
      if (node) {
        // Node label already answers "what is this" — no competing tooltip.
        setEdgeTooltip((prev) => (prev ? null : prev));
        if (hoveredClusterTagIdRef.current !== null) {
          hoveredClusterTagIdRef.current = null;
          draw();
        }
        setHoverCursor(true);
        return;
      }
      // Cluster labels take precedence over edges — they're a more obvious
      // click target and edges below them stay hoverable elsewhere.
      const cluster = pickClusterLabel(clusterHitboxesRef.current, px, py);
      const clusterTagId = cluster?.tagId ?? null;
      if (clusterTagId !== hoveredClusterTagIdRef.current) {
        hoveredClusterTagIdRef.current = clusterTagId;
        draw();
      }
      if (cluster) {
        setEdgeTooltip((prev) => (prev ? null : prev));
        setHoverCursor(true);
        return;
      }
      setHoverCursor(false);
      const edge = pickEdge(visibleLinksRef.current, t, px, py);
      if (!edge) {
        setEdgeTooltip((prev) => (prev ? null : prev));
        return;
      }
      setEdgeTooltip((prev) => {
        if (
          prev &&
          prev.link === edge &&
          Math.abs(prev.x - px) < TOOLTIP_MOVE_THRESHOLD &&
          Math.abs(prev.y - py) < TOOLTIP_MOVE_THRESHOLD
        ) {
          return prev;
        }
        return { x: px, y: py, link: edge };
      });
    };

    const onPointerLeave = () => {
      setEdgeTooltip(null);
      setHoverCursor(false);
      if (hoverIdRef.current !== null) {
        hoverIdRef.current = null;
        draw();
      }
      if (hoveredClusterTagIdRef.current !== null) {
        hoveredClusterTagIdRef.current = null;
        draw();
      }
    };

    const onClick = (event: MouseEvent) => {
      const point = toCanvasPoint(event);
      if (!point) return;
      const node = pickNode(
        simNodes,
        transformRef.current,
        point.x,
        point.y,
      );
      if (node) {
        onNodeSelectRef.current(node);
        return;
      }
      // Cluster label click → open the tag's source list. Don't fire node
      // deselect alongside it; treat them as separate click targets.
      const cluster = pickClusterLabel(
        clusterHitboxesRef.current,
        point.x,
        point.y,
      );
      if (cluster) {
        onClusterSelectRef.current(cluster.tagId);
        return;
      }
      onNodeSelectRef.current(null);
    };

    const selection = select(canvas);
    const zoomBehavior = d3zoom<HTMLCanvasElement, unknown>()
      .scaleExtent([0.1, 4])
      .filter((event) => {
        // macOS trackpad pinch-zoom arrives as wheel events with ctrlKey:true,
        // so we accept all wheel events unconditionally (filtering by ctrlKey
        // would silently break pinch on Mac).
        if (event.type === "wheel") return true;
        // Suppress drags that start on a node so d3-drag wins those gestures.
        if (event.type === "mousedown" || event.type === "touchstart") {
          const clientPoint = clientPointFromEvent(event);
          if (!clientPoint) return false;
          const rect = canvas.getBoundingClientRect();
          return !pickNode(
            simNodes,
            transformRef.current,
            clientPoint.x - rect.left,
            clientPoint.y - rect.top,
          );
        }
        return !event.button;
      })
      .on("zoom", (event) => {
        transformRef.current = event.transform;
        draw();
      });

    const toCanvasPoint = (
      sourceEvent: Event,
    ): { x: number; y: number } | null => {
      const clientPoint = clientPointFromEvent(sourceEvent);
      if (!clientPoint) return null;
      const rect = canvas.getBoundingClientRect();
      return {
        x: clientPoint.x - rect.left,
        y: clientPoint.y - rect.top,
      };
    };

    // d3-drag preserves the pointer-to-subject offset internally. The subject
    // must therefore be expressed in the same coordinate system as the drag
    // container: canvas pixels. The simulation still receives graph coords.
    let didReheatForDrag = false;

    const dragBehavior = d3drag<
      HTMLCanvasElement,
      unknown,
      GraphDragSubject<SimNode> | undefined
    >()
      .container(() => canvas)
      .filter((event) => !event.button)
      .subject((event) => {
        const point = toCanvasPoint(event.sourceEvent);
        if (!point) return undefined;
        const node = pickNode(
          simNodes,
          transformRef.current,
          point.x,
          point.y,
        );
        return createGraphDragSubject(node, transformRef.current) ?? undefined;
      })
      .on("start", (event) => {
        if (!event.subject) return;
        if (hoverIdRef.current !== null) {
          hoverIdRef.current = null;
          setHoverCursor(false);
        }
        // d3-drag captures pointer events, so onPointerMove won't fire to
        // clear a sticky cluster-label hover during the drag. Reset it now.
        if (hoveredClusterTagIdRef.current !== null) {
          hoveredClusterTagIdRef.current = null;
        }
        setEdgeTooltip((prev) => (prev ? null : prev));
        didReheatForDrag = false;
        const node = event.subject.node;
        node.fx = node.x ?? null;
        node.fy = node.y ?? null;
        draw();
      })
      .on("drag", (event) => {
        if (!event.subject) return;
        if (!didReheatForDrag) {
          const moved = Math.hypot(
            event.x - event.subject.x,
            event.y - event.subject.y,
          );
          if (moved >= DRAG_REHEAT_THRESHOLD_PX) {
            sim.alphaTarget(0.3).restart();
            didReheatForDrag = true;
          }
        }
        const graphPoint = canvasToGraphPoint(transformRef.current, {
          x: event.x,
          y: event.y,
        });
        const node = event.subject.node;
        applyGraphDragPosition(node, graphPoint);
        node.fx = graphPoint.x;
        node.fy = graphPoint.y;
        draw();
      })
      .on("end", (event) => {
        if (!event.subject) return;
        if (didReheatForDrag && !event.active) sim.alphaTarget(0);
        event.subject.node.fx = null;
        event.subject.node.fy = null;
      });

    selection.call(zoomBehavior);
    selection.call(dragBehavior);
    zoomBehaviorRef.current = zoomBehavior;
    canvasSelectionRef.current = selection;
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerleave", onPointerLeave);
    canvas.addEventListener("click", onClick);

    const ro = new ResizeObserver(() => resize());
    ro.observe(container);
    resize();
    draw();

    return () => {
      sim.stop();
      simRef.current = null;
      linkForceRef.current = null;
      drawRef.current = null;
      ro.disconnect();
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerleave", onPointerLeave);
      canvas.removeEventListener("click", onClick);
      selection.on(".zoom", null);
      selection.on(".drag", null);
      zoomBehaviorRef.current = null;
      canvasSelectionRef.current = null;
      if (pulseRafRef.current != null) {
        cancelAnimationFrame(pulseRafRef.current);
        pulseRafRef.current = null;
      }
      panAnimationRef.current?.cancel();
      panAnimationRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [simNodes, allLinks, containmentLinks]);

  // Threshold changes: rebuild visible link list, swap into the link force,
  // rebuild adjacency, reheat. Node positions stay put so users see clusters
  // separate rather than the whole graph re-tumbling.
  useEffect(() => {
    const sim = simRef.current;
    const linkForce = linkForceRef.current;
    if (!sim || !linkForce) return;
    const visible = selectVisibleLinks(
      allLinks,
      containmentLinks,
      threshold,
      tagThreshold,
    );
    visibleLinksRef.current = visible;
    adjacencyRef.current = buildAdjacency(visible);
    linkForce.links(visible);
    sim.alpha(0.5).restart();
    drawRef.current?.();
  }, [threshold, tagThreshold, allLinks, containmentLinks]);

  const highlightNode = useCallback((nodeId: string | null) => {
    if (nodeId === highlightIdRef.current) return;
    highlightIdRef.current = nodeId;

    // Cancel any in-flight pulse and pan; both are about the previous target.
    if (pulseRafRef.current != null) {
      cancelAnimationFrame(pulseRafRef.current);
      pulseRafRef.current = null;
    }
    panAnimationRef.current?.cancel();
    panAnimationRef.current = null;

    if (nodeId == null) {
      drawRef.current?.();
      return;
    }

    // Drive the pulse via rAF. Each frame redraws so the sine breathes; the
    // loop bails on its own when the highlight changes.
    pulseStartRef.current = performance.now();
    const tickPulse = () => {
      if (highlightIdRef.current !== nodeId) {
        pulseRafRef.current = null;
        return;
      }
      drawRef.current?.();
      pulseRafRef.current = requestAnimationFrame(tickPulse);
    };
    pulseRafRef.current = requestAnimationFrame(tickPulse);

    // Pan only if we have everything we need; the pulse renders regardless.
    const node = nodeByIdRef.current.get(nodeId);
    const { width, height } = sizeRef.current;
    const selection = canvasSelectionRef.current;
    const zoomBehavior = zoomBehaviorRef.current;
    if (
      !node ||
      node.x == null ||
      node.y == null ||
      width === 0 ||
      height === 0 ||
      !selection ||
      !zoomBehavior
    ) {
      return;
    }

    panAnimationRef.current = animatePanToGraphPoint({
      selection,
      zoomBehavior,
      start: transformRef.current,
      graphX: node.x,
      graphY: node.y,
      viewportWidth: width,
      viewportHeight: height,
      durationMs: PAN_DURATION_MS,
      isCancelled: () => highlightIdRef.current !== nodeId,
    });
  }, []);

  return { edgeTooltip, hoverCursor, highlightNode };
}
