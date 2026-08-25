import { useMemo } from "react";
import { useSources } from "@/features/sources/hooks/sources";
import { useTags } from "@/features/tags/hooks";
import { useTakeaway, useTakeaways } from "@/features/takeaways/hooks";
import { useNote, useAllNotes } from "@/features/notes/hooks";
import type { SourceDTO } from "@/features/sources/types";
import type { SourceTakeawayDTO } from "@/features/takeaways/types";
import type { NoteDTO } from "@/features/notes/types";
import {
  EDGE_KIND,
  selectVisibleLinks,
  type SimLink,
  type SimNode,
} from "@/features/graph/lib/edge-kinds";
import { linkEndpointId } from "@/features/graph/lib/geometry";
import { colorForTag } from "@/features/graph/lib/colors";

export interface RelatedNode {
  node: SimNode;
  similarity: number;
  kind: "semantic" | "structural";
  shared_quotes?: number;
}

export interface TagChip {
  id: number;
  label: string;
  color: string;
}

export interface RelatedSource {
  node: SimNode;
  jaccard: number;
  shared_tag_ids: number[];
}

// Quotes grouped by speaker/author for the "Referenced quotes" panel.
export interface QuoteGroup {
  speaker: string;
  count: number;
}

export interface SourceTakeawayPreview {
  id: number;
  title: string;
  citationCount: number;
}

export interface NodeInspectorData {
  related: RelatedNode[];
  themes: TagChip[];
  relatedSources: RelatedSource[];
  neighborCount: number;
  // Source-derived enrichments.
  summary?: string;
  author?: string;
  sourceLabel?: string;
  // For source nodes: the source's own takeaways (top by citation count).
  sourceTakeaways: SourceTakeawayPreview[];
  sourceTakeawayTotal: number;
  // Entity-derived enrichments (takeaway/note details).
  quotes: QuoteGroup[];
  totalQuotes: number;
  firstSeen?: string;
  lastEdited?: string;
  linkedNoteCount: number;
  isLoadingEntity: boolean;
}

interface Params {
  selected: SimNode | null;
  simNodes: SimNode[];
  allLinks: SimLink[];
  containmentLinks: SimLink[];
  threshold: number;
  tagThreshold: number;
}

// Builds the structured payload the inspector renders from. Pulls from the
// existing graph data + sources/tags queries plus an on-demand fetch of the
// selected entity (takeaway or note) so we can surface quote attribution,
// dates, and back-links.
export function useNodeInspectorData(params: Params): NodeInspectorData {
  const {
    selected,
    simNodes,
    allLinks,
    containmentLinks,
    threshold,
    tagThreshold,
  } = params;
  const { data: sourcesData } = useSources();
  const { data: tagsData } = useTags();

  const takeawaySourceId =
    selected?.node.kind === "takeaway" ? selected.node.source_id ?? 0 : 0;
  const takeawayEntityId =
    selected?.node.kind === "takeaway" ? selected.node.entity_id : 0;
  const noteEntityId =
    selected?.node.kind === "note" ? selected.node.entity_id : 0;
  const sourceListId =
    selected?.node.kind === "source" ? selected.node.source_id ?? 0 : 0;

  const takeawayQuery = useTakeaway(takeawaySourceId, takeawayEntityId);
  const noteQuery = useNote(noteEntityId);
  const allNotesQuery = useAllNotes();
  const sourceTakeawaysQuery = useTakeaways(sourceListId);

  return useMemo(() => {
    const empty: NodeInspectorData = {
      related: [],
      themes: [],
      relatedSources: [],
      neighborCount: 0,
      sourceTakeaways: [],
      sourceTakeawayTotal: 0,
      quotes: [],
      totalQuotes: 0,
      linkedNoteCount: 0,
      isLoadingEntity: false,
    };
    if (!selected) return empty;

    const nodeById = new Map<string, SimNode>();
    for (const n of simNodes) nodeById.set(n.id, n);
    const visibleLinks = selectVisibleLinks(
      allLinks,
      containmentLinks,
      threshold,
      tagThreshold,
    );

    // Related nodes: semantic + structural edges touching the selected node,
    // sorted by similarity. Containment is excluded — "this idea belongs to
    // its source" isn't a discovery, it's a fact.
    const related: RelatedNode[] = [];
    for (const link of visibleLinks) {
      const sId = linkEndpointId(link.source);
      const tId = linkEndpointId(link.target);
      if (sId !== selected.id && tId !== selected.id) continue;
      if (
        link.edge_type !== EDGE_KIND.Semantic &&
        link.edge_type !== EDGE_KIND.Structural
      )
        continue;
      const otherId = sId === selected.id ? tId : sId;
      const other = nodeById.get(otherId);
      if (!other) continue;
      related.push({
        node: other,
        similarity: link.similarity,
        kind:
          link.edge_type === EDGE_KIND.Semantic ? "semantic" : "structural",
        shared_quotes: link.shared_citation_ids?.length,
      });
    }
    related.sort((a, b) => b.similarity - a.similarity);

    // Neighbor count: every visible adjacency, including containment.
    let neighborCount = 0;
    for (const link of visibleLinks) {
      const sId = linkEndpointId(link.source);
      const tId = linkEndpointId(link.target);
      if (sId === selected.id || tId === selected.id) neighborCount++;
    }

    // Themes: the selected node's source's tags, rendered as chips. For
    // source nodes we use their own tags; for takeaways/notes we inherit
    // from the containing source.
    const sourceById = new Map<number, SourceDTO>();
    for (const s of sourcesData?.sources ?? []) sourceById.set(s.id, s);

    const tagLabelById = new Map<number, string>();
    const tagUserColorById = new Map<number, string | undefined>();
    for (const t of tagsData ?? []) {
      tagLabelById.set(t.id, t.label);
      tagUserColorById.set(t.id, t.color ?? undefined);
    }

    const themeSourceId =
      selected.node.kind === "source"
        ? selected.node.source_id
        : selected.node.source_id ?? null;
    const themes: TagChip[] = [];
    if (themeSourceId != null) {
      const src = sourceById.get(themeSourceId);
      for (const tagId of src?.tag_ids ?? []) {
        themes.push({
          id: tagId,
          label: tagLabelById.get(tagId) ?? `#${tagId}`,
          color: tagUserColorById.get(tagId) || colorForTag(tagId),
        });
      }
    }

    // Connected sources: only meaningful for source nodes. Tag-jaccard edges
    // touching this source, ranked by overlap strength.
    const relatedSources: RelatedSource[] = [];
    if (selected.node.kind === "source") {
      for (const link of visibleLinks) {
        if (link.edge_type !== EDGE_KIND.Tag) continue;
        const sId = linkEndpointId(link.source);
        const tId = linkEndpointId(link.target);
        if (sId !== selected.id && tId !== selected.id) continue;
        const otherId = sId === selected.id ? tId : sId;
        const other = nodeById.get(otherId);
        if (!other) continue;
        relatedSources.push({
          node: other,
          jaccard: link.similarity,
          shared_tag_ids: link.shared_tag_ids ?? [],
        });
      }
      relatedSources.sort((a, b) => b.jaccard - a.jaccard);
    }

    // Source-derived enrichments.
    const srcForEnrichment =
      themeSourceId != null ? sourceById.get(themeSourceId) : undefined;
    const sourceLabel = srcForEnrichment?.label;

    let summary: string | undefined;
    let author: string | undefined = srcForEnrichment?.author;
    let firstSeen: string | undefined;
    let lastEdited: string | undefined;
    const quotes: QuoteGroup[] = [];
    let totalQuotes = 0;

    if (selected.node.kind === "source") {
      summary = srcForEnrichment?.summary_short ?? srcForEnrichment?.summary_long;
      firstSeen = srcForEnrichment?.created_at;
      lastEdited = srcForEnrichment?.updated_at;
      // Count quotes across this source's takeaways; speaker grouping isn't
      // meaningful here since everything's same-source.
      for (const t of sourceTakeawaysQuery.data ?? []) {
        totalQuotes += t.citations?.length ?? 0;
      }
    } else if (selected.node.kind === "takeaway") {
      const t = takeawayQuery.data as SourceTakeawayDTO | undefined;
      if (t) {
        summary = t.body || undefined;
        firstSeen = t.created_at;
        lastEdited = t.updated_at;
        totalQuotes = t.citations?.length ?? 0;
      }
    } else if (selected.node.kind === "note") {
      const n = noteQuery.data as NoteDTO | undefined;
      if (n) {
        firstSeen = n.created_at;
        lastEdited = n.updated_at;
        totalQuotes = n.citation_ids?.length ?? 0;
        // Note citations span sources — group by the source author of each
        // citation. Notes only ship `citation_ids`, so we rely on the graph's
        // citation nodes to resolve each citation's source/speaker. Falls back
        // to "Other" if a citation isn't in the current graph slice.
        if (n.citation_ids && n.citation_ids.length > 0) {
          const citationNodeById = new Map<number, SimNode>();
          for (const sn of simNodes) {
            if (sn.node.kind === "citation") {
              citationNodeById.set(sn.node.entity_id, sn);
            }
          }
          const byAttribution = new Map<string, number>();
          for (const cid of n.citation_ids) {
            const cnode = citationNodeById.get(cid);
            let label = "Other";
            if (cnode && cnode.node.kind === "citation") {
              const speaker = (cnode.node.speaker ?? "").trim();
              const srcAuthor = cnode.node.source_id
                ? sourceById.get(cnode.node.source_id)?.author
                : undefined;
              label =
                speaker ||
                srcAuthor ||
                cnode.node.source_title ||
                "Other";
            }
            byAttribution.set(label, (byAttribution.get(label) ?? 0) + 1);
          }
          for (const [speaker, count] of byAttribution) {
            quotes.push({ speaker, count });
          }
          quotes.sort((a, b) => b.count - a.count);
        }
      }
    } else if (selected.node.kind === "citation") {
      // Citation nodes don't have their own summary endpoint here — fall back
      // to the inline quote text the graph payload already carries.
      summary = selected.node.text || undefined;
      author = (selected.node.speaker ?? author) || undefined;
    }

    // Linked notes count: notes that reference this entity. We approximate by
    // counting notes whose source_id matches a takeaway/citation's source, or
    // for source nodes, the source itself. This is a structural signal — the
    // exact citation_ids→note join would need a dedicated endpoint.
    let linkedNoteCount = 0;
    const notes = allNotesQuery.data ?? [];
    if (selected.node.kind === "note") {
      linkedNoteCount = 0;
    } else if (themeSourceId != null) {
      for (const n of notes) {
        if (n.source_id === themeSourceId) linkedNoteCount++;
      }
    }

    const sourceTakeawayList = sourceTakeawaysQuery.data ?? [];
    const sourceTakeaways: SourceTakeawayPreview[] =
      selected.node.kind === "source"
        ? sourceTakeawayList
            .map((t) => ({
              id: t.id,
              title: t.title,
              citationCount: t.citations?.length ?? 0,
            }))
            .sort((a, b) => b.citationCount - a.citationCount)
        : [];

    return {
      related,
      themes,
      relatedSources,
      neighborCount,
      summary,
      author,
      sourceLabel,
      sourceTakeaways,
      sourceTakeawayTotal: sourceTakeawayList.length,
      quotes,
      totalQuotes,
      firstSeen,
      lastEdited,
      linkedNoteCount,
      isLoadingEntity:
        (selected.node.kind === "takeaway" && takeawayQuery.isLoading) ||
        (selected.node.kind === "note" && noteQuery.isLoading) ||
        (selected.node.kind === "source" && sourceTakeawaysQuery.isLoading),
    };
  }, [
    selected,
    simNodes,
    allLinks,
    containmentLinks,
    threshold,
    tagThreshold,
    sourcesData,
    tagsData,
    takeawayQuery.data,
    takeawayQuery.isLoading,
    noteQuery.data,
    noteQuery.isLoading,
    allNotesQuery.data,
    sourceTakeawaysQuery.data,
    sourceTakeawaysQuery.isLoading,
  ]);
}
