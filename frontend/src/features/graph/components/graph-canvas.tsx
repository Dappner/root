"use client";

import { useCallback, useMemo, useRef } from "react";
import {
  CanvasSurface,
  type CanvasSurfaceHandle,
} from "@/features/graph/components/canvas-surface";
import { useGraphSelectionUrl } from "@/features/graph/hooks/use-graph-selection-url";
import { useNodeInspectorData } from "@/features/graph/hooks/use-node-inspector-data";
import {
  type SimLink,
  type SimNode,
} from "@/features/graph/lib/edge-kinds";
import type { TagCluster } from "@/features/graph/lib/clusters";
import { GraphNodeInspector } from "@/features/graph/components/graph-node-inspector";
import { TagSourcesSheet } from "@/features/graph/components/tag-sources-sheet";

interface GraphCanvasProps {
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
}

export function GraphCanvas(props: GraphCanvasProps) {
  const { selectedNodeId, selectedTagId, setSelection, clearSelection } =
    useGraphSelectionUrl();

  // Imperative handle to the canvas — lets sidebars trigger pulse/pan without
  // making this component re-render on every graph hover.
  const canvasController = useRef<CanvasSurfaceHandle | null>(null);

  const selectedNode = useMemo(
    () => props.simNodes.find((node) => node.id === selectedNodeId) ?? null,
    [props.simNodes, selectedNodeId],
  );

  // Set of source IDs with an actual node on the canvas. Used by the tag
  // sheet to decide whether a source row should focus its graph node or
  // fall back to a library link.
  const graphSourceIds = useMemo(() => {
    const ids = new Set<number>();
    for (const n of props.simNodes) {
      if (n.node.kind === "source") ids.add(n.node.source_id);
    }
    return ids;
  }, [props.simNodes]);

  const inspectorData = useNodeInspectorData({
    selected: selectedNode,
    simNodes: props.simNodes,
    allLinks: props.allLinks,
    containmentLinks: props.containmentLinks,
    threshold: props.threshold,
    tagThreshold: props.tagThreshold,
  });

  // Stable callbacks so memoized sidebars don't re-render on parent updates.
  const handleNodeSelect = useCallback(
    (node: SimNode | null) => {
      if (node) {
        setSelection({ kind: "node", nodeId: node.id });
      } else if (selectedTagId == null) {
        // Empty-canvas click — only clear when there's nothing tag-level to
        // preserve. A sticky tag focus (sheet open) should survive a
        // background click, since the user's selection target is the tag, not
        // whatever node happened to be selected before.
        clearSelection();
      }
    },
    [setSelection, clearSelection, selectedTagId],
  );

  const handleClusterSelect = useCallback(
    (tagId: number) => setSelection({ kind: "tag", tagId }),
    [setSelection],
  );

  const handleSelectNode = useCallback(
    (node: SimNode) => setSelection({ kind: "node", nodeId: node.id }),
    [setSelection],
  );

  const handleSelectTag = useCallback(
    (tagId: number) => setSelection({ kind: "tag", tagId }),
    [setSelection],
  );

  const handleSelectSource = useCallback(
    (sourceId: number) =>
      setSelection({ kind: "node", nodeId: `source:${sourceId}` }),
    [setSelection],
  );

  const handleHoverNode = useCallback((nodeId: string | null) => {
    canvasController.current?.highlight(nodeId);
  }, []);

  const handleHoverSource = useCallback((sourceId: number | null) => {
    canvasController.current?.highlight(
      sourceId == null ? null : `source:${sourceId}`,
    );
  }, []);

  return (
    <div className="relative h-full w-full bg-background overflow-hidden">
      <CanvasSurface
        controllerRef={canvasController}
        simNodes={props.simNodes}
        allLinks={props.allLinks}
        containmentLinks={props.containmentLinks}
        threshold={props.threshold}
        tagThreshold={props.tagThreshold}
        clusters={props.clusters}
        tagLabelById={props.tagLabelById}
        tagColorById={props.tagColorById}
        showClusters={props.showClusters}
        showRegions={props.showRegions}
        isDark={props.isDark}
        selectedNodeId={selectedNode?.id ?? null}
        focusedTagId={selectedTagId}
        onNodeSelect={handleNodeSelect}
        onClusterSelect={handleClusterSelect}
      />
      {selectedNode && (
        <GraphNodeInspector
          node={selectedNode}
          data={inspectorData}
          onClose={clearSelection}
          onSelectNode={handleSelectNode}
          onSelectTag={handleSelectTag}
          onHoverNode={handleHoverNode}
        />
      )}
      {selectedTagId !== null && (
        <TagSourcesSheet
          tagId={selectedTagId}
          onClose={clearSelection}
          onSelectSource={handleSelectSource}
          graphSourceIds={graphSourceIds}
          onHoverSource={handleHoverSource}
        />
      )}
    </div>
  );
}
