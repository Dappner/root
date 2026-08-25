"use client";

import type { SuggestionWithSource } from "../../types";
import { groupSuggestionsBySource } from "../../utils";
import { SourceGroupRow } from "./source-group-row";
import { statusToFilter } from "./types";

interface SuggestionsListProps {
  /** Already filtered to the active tab + sorted. Grouped by source here. */
  suggestions: SuggestionWithSource[];
  /** Opens the full-screen reviewer for a source group. */
  onReview: (sourceId: number) => void;
}

export function SuggestionsList({ suggestions, onReview }: SuggestionsListProps) {
  const groups = groupSuggestionsBySource(suggestions);

  return (
    <div className="space-y-2">
      {groups.map((group) => (
        <SourceGroupRow key={group.sourceId} group={group} onReview={onReview} />
      ))}
    </div>
  );
}

/** Partition suggestions into status buckets (drives the per-tab counts). */
export function partitionSuggestions(suggestions: SuggestionWithSource[]) {
  const ready: SuggestionWithSource[] = [];
  const processing: SuggestionWithSource[] = [];
  const failed: SuggestionWithSource[] = [];
  for (const s of suggestions) {
    const bucket = statusToFilter(s.status);
    if (bucket === "ready") ready.push(s);
    else if (bucket === "processing") processing.push(s);
    else if (bucket === "failed") failed.push(s);
  }
  return { ready, processing, failed };
}
