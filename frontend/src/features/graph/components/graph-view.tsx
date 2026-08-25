"use client";

import { useState } from "react";
import { useTheme } from "next-themes";

import { Skeleton } from "@/components/ui/skeleton";
import { GraphCanvas } from "@/features/graph/components/graph-canvas";
import { GraphToolbar } from "@/features/graph/components/graph-toolbar";
import { useGraphData } from "@/features/graph/hooks/use-graph-data";
import { useTagClusters } from "@/features/graph/hooks/use-tag-clusters";

export function GraphView() {
  const { simNodes, allLinks, containmentLinks, isPending, isError, isEmpty } =
    useGraphData();
  const { clusters, labelById, colorById } = useTagClusters();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  // Semantic threshold gates noisy similarity edges; structural always shows.
  // Tag threshold gates source ↔ source jaccard separately — jaccard scores
  // cluster lower than cosine so they want their own knob.
  const [threshold, setThreshold] = useState(0.4);
  const [tagThreshold, setTagThreshold] = useState(0.5);
  const [showClusters, setShowClusters] = useState(true);
  const [showRegions, setShowRegions] = useState(true);

  if (isPending) {
    return (
      <div className="h-full w-full p-8 space-y-4">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-[calc(100vh-12rem)] w-full" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="h-full w-full flex items-center justify-center">
        <p className="text-sm text-muted-foreground">
          Couldn&apos;t load your graph. Try refreshing.
        </p>
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div className="h-full w-full flex items-center justify-center px-8">
        <div className="max-w-md text-center space-y-3">
          <h2 className="text-lg font-semibold">Your graph is empty</h2>
          <p className="text-sm text-muted-foreground">
            Your knowledge graph grows as you capture takeaways and write
            notes. Edges appear when you cite the same quote in multiple
            places, or when takeaways across sources are semantically close.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      <GraphCanvas
        simNodes={simNodes}
        allLinks={allLinks}
        containmentLinks={containmentLinks}
        threshold={threshold}
        tagThreshold={tagThreshold}
        clusters={clusters}
        tagLabelById={labelById}
        tagColorById={colorById}
        showClusters={showClusters}
        showRegions={showRegions}
        isDark={isDark}
      />
      <GraphToolbar
        threshold={threshold}
        onThresholdChange={setThreshold}
        tagThreshold={tagThreshold}
        onTagThresholdChange={setTagThreshold}
        showClusters={showClusters}
        onShowClustersChange={setShowClusters}
        showRegions={showRegions}
        onShowRegionsChange={setShowRegions}
      />
    </div>
  );
}
