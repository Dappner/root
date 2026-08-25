"use client";

import { useEffect, useRef, type RefObject } from "react";

import { EdgeTooltip } from "@/features/graph/components/edge-tooltip";
import { useCanvasSimulation } from "@/features/graph/hooks/use-canvas-simulation";
import type { SimLink, SimNode } from "@/features/graph/lib/edge-kinds";
import type { TagCluster } from "@/features/graph/lib/clusters";

// Imperative handle so the parent can drive the canvas (e.g. highlight a node
// from a sidebar hover) without having to re-render when the canvas's internal
// cursor/tooltip state changes. This is the load-bearing piece that keeps the
// sidebars from re-rendering on every graph hover.
export interface CanvasSurfaceHandle {
  highlight: (nodeId: string | null) => void;
}

interface CanvasSurfaceProps {
  controllerRef: RefObject<CanvasSurfaceHandle | null>;
  simNodes: SimNode[];
  allLinks: SimLink[];
  containmentLinks: SimLink[];
  threshold: number;
  tagThreshold: number;
  clusters: TagCluster[];
  tagLabelById: Map<number, string>;
  tagColorById: Map<number, string>;
  showClusters: boolean;
  showRegions: boolean;
  isDark: boolean;
  selectedNodeId: string | null;
  focusedTagId: number | null;
  onNodeSelect: (node: SimNode | null) => void;
  onClusterSelect: (tagId: number) => void;
}

export function CanvasSurface({
  controllerRef,
  simNodes,
  allLinks,
  containmentLinks,
  threshold,
  tagThreshold,
  clusters,
  tagLabelById,
  tagColorById,
  showClusters,
  showRegions,
  isDark,
  selectedNodeId,
  focusedTagId,
  onNodeSelect,
  onClusterSelect,
}: CanvasSurfaceProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const { edgeTooltip, hoverCursor, highlightNode } = useCanvasSimulation({
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
  });

  // Populate the parent's ref so it can call .highlight() without subscribing
  // to this component's render cycle. highlightNode is stable (useCallback []),
  // so this effect fires once per mount.
  useEffect(() => {
    controllerRef.current = { highlight: highlightNode };
    return () => {
      controllerRef.current = null;
    };
  }, [controllerRef, highlightNode]);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0"
      style={{ cursor: hoverCursor ? "pointer" : "grab" }}
    >
      <canvas ref={canvasRef} className="absolute inset-0" />
      {edgeTooltip && (
        <EdgeTooltip state={edgeTooltip} tagLabelById={tagLabelById} />
      )}
    </div>
  );
}
