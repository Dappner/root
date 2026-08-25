import { useMemo } from "react";
import type {
  CaptureDTO,
  CitationResponse as CitationDTO,
} from "@/lib/api/rag-generated";
import {
  sourcesKeys,
  useSource,
  useSourceCaptures,
  useSourceCitations,
  useSourceSections,
  useSourceTakeaways,
} from "../hooks";
import { suggestionsKeys, useSourceSuggestions } from "@/features/suggestions/hooks";
import { notesKeys, useNotesBySource } from "@/features/notes/hooks";
import { podcastsKeys } from "@/features/podcasts/hooks";
import { groupHighlights, type GroupedSection } from "../components/highlights";

export type HubActivityItem =
  | { kind: "citation"; item: CitationDTO }
  | { kind: "capture"; item: CaptureDTO };

const REVIEWABLE_SUGGESTION_STATUSES = ["ready", "processing", "failed"] as const;

export function useSourceHubData(sourceId: number | null) {
  const { data: source, isLoading } = useSource(sourceId);
  const { data: sections = [] } = useSourceSections(sourceId);
  const { data: citations = [] } = useSourceCitations(sourceId);
  const { data: captures = [] } = useSourceCaptures(sourceId);
  const { data: takeaways = [] } = useSourceTakeaways(sourceId);
  const { data: suggestions = [] } = useSourceSuggestions(sourceId);
  const { data: sourceNotes = [] } = useNotesBySource(sourceId);

  const refreshKeys = useMemo(
    () =>
      sourceId
        ? [
            sourcesKeys.detail(sourceId),
            sourcesKeys.sections(sourceId),
            sourcesKeys.citations(sourceId),
            sourcesKeys.captures(sourceId),
            sourcesKeys.takeaways(sourceId),
            suggestionsKeys.source(sourceId),
            notesKeys.bySource(sourceId),
            ...(source?.episode_id
              ? [
                  podcastsKeys.transcriptStatus(source.episode_id),
                  podcastsKeys.transcriptContent(source.episode_id),
                ]
              : []),
          ]
        : [],
    [sourceId, source?.episode_id]
  );

  const standaloneCaptures = useMemo(
    () => captures.filter((c) => c.citation_id == null),
    [captures]
  );

  const recentActivity = useMemo<HubActivityItem[]>(() => {
    const items: HubActivityItem[] = [
      ...citations.map((c) => ({ kind: "citation" as const, item: c })),
      ...standaloneCaptures.map((c) => ({ kind: "capture" as const, item: c })),
    ];
    return items
      .sort((a, b) => new Date(b.item.created_at).getTime() - new Date(a.item.created_at).getTime())
      .slice(0, 3);
  }, [citations, standaloneCaptures]);

  const { sectionGroups, unsorted } = useMemo(
    () => groupHighlights(sections, citations, captures),
    [sections, citations, captures]
  );

  const highlightGroups = useMemo<GroupedSection[]>(() => {
    const groups: GroupedSection[] = [];
    if (unsorted.citationsWithCaptures.length > 0 || unsorted.standaloneCaptures.length > 0) {
      groups.push(unsorted);
    }
    for (const g of sectionGroups) {
      if (g.citationsWithCaptures.length > 0 || g.standaloneCaptures.length > 0) {
        groups.push(g);
      }
    }
    return groups;
  }, [sectionGroups, unsorted]);

  const totalHighlights = citations.length + standaloneCaptures.length;
  const reviewableSuggestionCount = suggestions.filter((s) =>
    REVIEWABLE_SUGGESTION_STATUSES.includes(s.status as (typeof REVIEWABLE_SUGGESTION_STATUSES)[number])
  ).length;

  return {
    source,
    isLoading,
    sections,
    citations,
    captures,
    standaloneCaptures,
    takeaways,
    sourceNotes,
    refreshKeys,
    recentActivity,
    highlightGroups,
    totalHighlights,
    reviewableSuggestionCount,
  };
}
