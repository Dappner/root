import { useMemo } from "react";
import { useGraph } from "@/features/graph/hooks/queries";
import { useSources } from "@/features/sources/hooks/sources";
import type { SourceDTO } from "@/features/sources/types";
import {
  EDGE_KIND,
  type EdgeKind,
  type SimLink,
  type SimNode,
} from "@/features/graph/lib/edge-kinds";
import type { SourceNode } from "@/features/graph/lib/source-node";

interface GraphData {
  simNodes: SimNode[];
  allLinks: SimLink[];
  containmentLinks: SimLink[];
  isPending: boolean;
  isError: boolean;
  isEmpty: boolean;
}

export function useGraphData(): GraphData {
  const { data, isPending, isError } = useGraph();
  const { data: sourcesData } = useSources();

  const { simNodes, allLinks, containmentLinks } = useMemo(() => {
    const nodes: SimNode[] = (data?.nodes ?? []).map((n) => ({
      id: n.id,
      node: n,
    }));
    const links: SimLink[] = (data?.edges ?? []).map((e) => ({
      source: e.source,
      target: e.target,
      similarity:
        e.edge_type === EDGE_KIND.Structural ? 1.0 : (e.similarity ?? 0.5),
      edge_type: e.edge_type as EdgeKind,
      shared_citation_ids: e.shared_citation_ids,
    }));
    const contains: SimLink[] = [];

    const sourceById = new Map<number, SourceDTO>();
    for (const s of sourcesData?.sources ?? []) sourceById.set(s.id, s);

    // Sources without graph presence don't earn a node — we don't render the
    // entire library, just the part connected to ideas.
    const childrenBySource = new Map<number, string[]>();
    for (const n of data?.nodes ?? []) {
      if (n.source_id == null) continue;
      if (n.kind !== "takeaway" && n.kind !== "note") continue;
      const list = childrenBySource.get(n.source_id) ?? [];
      list.push(n.id);
      childrenBySource.set(n.source_id, list);
    }

    for (const [sid, children] of childrenBySource) {
      const src = sourceById.get(sid);
      if (!src) continue;
      const sourceNodeId = `source:${sid}`;
      const sourceNode: SourceNode = {
        kind: "source",
        id: sourceNodeId,
        source_id: sid,
        title: src.title,
        childCount: children.length,
      };
      nodes.push({ id: sourceNodeId, node: sourceNode });
      for (const childId of children) {
        contains.push({
          source: sourceNodeId,
          target: childId,
          similarity: 1.0,
          edge_type: EDGE_KIND.Containment,
        });
      }
    }

    // Tag edges: jaccard over tag_ids between every pair of sources that
    // both made it into the node set. Cheap (n² over ≤ a few dozen sources)
    // and produces a single similarity score per pair, which the threshold
    // slider can gate.
    const sourceIdsInGraph = Array.from(childrenBySource.keys());
    for (let i = 0; i < sourceIdsInGraph.length; i++) {
      const aId = sourceIdsInGraph[i];
      if (aId === undefined) continue;
      const a = sourceById.get(aId);
      const aTags = new Set(a?.tag_ids ?? []);
      if (aTags.size === 0) continue;
      for (let j = i + 1; j < sourceIdsInGraph.length; j++) {
        const bId = sourceIdsInGraph[j];
        if (bId === undefined) continue;
        const b = sourceById.get(bId);
        const bTags = new Set(b?.tag_ids ?? []);
        if (bTags.size === 0) continue;
        let intersection = 0;
        const sharedTagIds: number[] = [];
        for (const t of aTags) {
          if (bTags.has(t)) {
            intersection++;
            sharedTagIds.push(t);
          }
        }
        if (intersection === 0) continue;
        const union = aTags.size + bTags.size - intersection;
        const jaccard = intersection / union;
        links.push({
          source: `source:${aId}`,
          target: `source:${bId}`,
          similarity: jaccard,
          edge_type: EDGE_KIND.Tag,
          shared_tag_ids: sharedTagIds,
        });
      }
    }

    return { simNodes: nodes, allLinks: links, containmentLinks: contains };
  }, [data, sourcesData]);

  return {
    simNodes,
    allLinks,
    containmentLinks,
    isPending,
    isError,
    isEmpty: !data || data.nodes.length === 0,
  };
}
