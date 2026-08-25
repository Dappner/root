import { useMemo } from "react";
import { useGraph } from "@/features/graph/hooks/queries";
import { useSources } from "@/features/sources/hooks/sources";
import { useTags } from "@/features/tags/hooks";
import type { SourceDTO } from "@/features/sources/types";
import { colorForTag } from "@/features/graph/lib/colors";
import type { TagCluster } from "@/features/graph/lib/clusters";

interface TagClustersData {
  clusters: TagCluster[];
  labelById: Map<number, string>;
  colorById: Map<number, string>;
}

export function useTagClusters(): TagClustersData {
  const { data } = useGraph();
  const { data: sourcesData } = useSources();
  const { data: tagsData } = useTags();

  // Tag id → label lookup for edge tooltips. Falls back to the id if a tag
  // hasn't loaded; user still gets *something* informative.
  const labelById = useMemo(() => {
    const m = new Map<number, string>();
    for (const t of tagsData ?? []) m.set(t.id, t.label);
    return m;
  }, [tagsData]);

  // User-stored color when set; otherwise a palette index by tag id so the
  // same tag always paints the same hue.
  const colorById = useMemo(() => {
    const m = new Map<number, string>();
    for (const t of tagsData ?? []) {
      m.set(t.id, t.color || colorForTag(t.id));
    }
    return m;
  }, [tagsData]);

  // Tag-projected clusters. For each tag attached to ≥2 sources currently in
  // the graph, the cluster is every takeaway/note belonging to any of those
  // sources. Tags present on only one source aren't a region.
  const clusters = useMemo<TagCluster[]>(() => {
    // Wait for tags too — without them, cluster labels would fall back to
    // `#${tagId}` AND the URL writer couldn't emit slugs, which would brick
    // the tag-sheet round-trip. Better to render nothing than render
    // clusters that can't be deep-linked.
    if (!data || !sourcesData || !tagsData) return [];

    const sourcesByTag = new Map<number, Set<number>>();
    const sourceById = new Map<number, SourceDTO>();
    for (const s of sourcesData.sources ?? []) sourceById.set(s.id, s);
    const sourceIdsInGraph = new Set<number>();
    for (const n of data.nodes) {
      if (n.source_id != null) sourceIdsInGraph.add(n.source_id);
    }
    for (const sid of sourceIdsInGraph) {
      const src = sourceById.get(sid);
      for (const tagId of src?.tag_ids ?? []) {
        const set = sourcesByTag.get(tagId) ?? new Set();
        set.add(sid);
        sourcesByTag.set(tagId, set);
      }
    }

    const out: TagCluster[] = [];
    for (const [tagId, sourceIds] of sourcesByTag) {
      if (sourceIds.size < 2) continue;
      const memberIds: string[] = [];
      for (const n of data.nodes) {
        if (n.source_id == null) continue;
        if (sourceIds.has(n.source_id)) memberIds.push(n.id);
      }
      if (memberIds.length < 3) continue;
      const label = labelById.get(tagId);
      if (!label) continue;
      out.push({ tagId, label, memberIds, sourceIds: [...sourceIds] });
    }
    // Larger clusters draw first so smaller ones overlay readably.
    out.sort((a, b) => b.memberIds.length - a.memberIds.length);
    return out;
  }, [data, sourcesData, tagsData, labelById]);

  return { clusters, labelById, colorById };
}
