import type { SuggestionResponse } from "../../types";

/** The status buckets the left-list tabs/cards filter by. */
export type SuggestionStatusFilter = "all" | "ready" | "processing" | "failed" | "dismissed";

export type SuggestionStatus = SuggestionResponse["status"];

/** Sort options for the left list. */
export type SuggestionSort = "recent" | "oldest" | "confidence";

/** Map a raw suggestion status to its coarse filter bucket. */
export function statusToFilter(status: SuggestionStatus): Exclude<SuggestionStatusFilter, "all"> | null {
  if (status === "ready") return "ready";
  if (status === "uploaded" || status === "processing") return "processing";
  if (status === "failed") return "failed";
  if (status === "dismissed") return "dismissed";
  return null; // approved — not shown in the review list
}
