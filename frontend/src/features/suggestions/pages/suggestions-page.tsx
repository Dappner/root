"use client";

import { useCallback, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "@/lib/nav";
import { CheckCircle2, RefreshCw } from "lucide-react";

import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { FilterSortRow } from "@/features/suggestions/components/suggestions-list/filter-sort-row";
import { StatusSummaryCards } from "@/features/suggestions/components/suggestions-list/status-summary-cards";
import {
  SuggestionsList,
  partitionSuggestions,
} from "@/features/suggestions/components/suggestions-list/suggestions-list";
import type {
  SuggestionSort,
  SuggestionStatusFilter,
} from "@/features/suggestions/components/suggestions-list/types";
import {
  useDismissedSuggestions,
  usePendingSuggestions,
  useRefreshSuggestions,
} from "@/features/suggestions/hooks";
import type { SuggestionWithSource } from "@/features/suggestions/types";
import { getSuggestionConfidence } from "@/features/suggestions/utils";

const VALID_FILTERS: SuggestionStatusFilter[] = [
  "all",
  "ready",
  "processing",
  "failed",
  "dismissed",
];
const VALID_SORTS: SuggestionSort[] = ["recent", "oldest", "confidence"];

export function SuggestionsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const { data: suggestions, isLoading, isFetching } = usePendingSuggestions();
  const refreshSuggestions = useRefreshSuggestions();

  // Filter / sort are driven by local state, NOT searchParams, so a tab or sort
  // click re-renders synchronously instead of waiting on a router navigation
  // (the data is already cached — there's nothing to fetch). The URL is seeded
  // from query params once on mount and mirrored back on each change as a
  // fire-and-forget side-effect so links stay shareable without blocking the
  // interaction. `router.replace` doesn't re-run these initializers.
  const [filter, setFilter] = useState<SuggestionStatusFilter>(() =>
    parseEnum(searchParams.get("filter"), VALID_FILTERS, "all"),
  );
  const [sort, setSort] = useState<SuggestionSort>(() =>
    parseEnum(searchParams.get("sort"), VALID_SORTS, "recent"),
  );

  // Dismissed history loads lazily — only when its tab is active.
  const dismissedActive = filter === "dismissed";
  const { data: dismissed, isLoading: dismissedLoading } =
    useDismissedSuggestions(dismissedActive);

  // Mirror the current view into the URL without blocking the click that caused
  // it. Reads `window.location.search` (not the memoized `searchParams`) so the
  // callback identity stays stable and each update sees the latest params.
  const syncParam = useCallback(
    (key: string, value: string | null) => {
      const params = new URLSearchParams(window.location.search);
      if (value === null) params.delete(key);
      else params.set(key, value);
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname);
    },
    [pathname, router],
  );

  const { ready, processing, failed } = useMemo(
    () => partitionSuggestions(suggestions),
    [suggestions],
  );

  const counts = {
    all: ready.length + processing.length + failed.length,
    ready: ready.length,
    processing: processing.length,
    failed: failed.length,
    // Only known once the lazy fetch runs; undefined keeps the tab count hidden.
    dismissed: dismissedActive ? dismissed.length : undefined,
  };

  // The suggestions shown under the active tab, sorted. "all" spans the three
  // pending buckets; a specific tab narrows to its bucket. The list groups
  // these by source for display.
  const visible = useMemo(() => {
    const base =
      filter === "dismissed"
        ? dismissed
        : filter === "processing"
          ? processing
          : filter === "failed"
            ? failed
            : filter === "ready"
              ? ready
              : [...ready, ...processing, ...failed];
    return sortSuggestions(base, sort);
  }, [filter, ready, processing, failed, dismissed, sort]);

  const handleFilter = (next: SuggestionStatusFilter) => {
    setFilter(next);
    syncParam("filter", next === "all" ? null : next);
  };
  const handleSort = (next: SuggestionSort) => {
    setSort(next);
    syncParam("sort", next === "recent" ? null : next);
  };
  // Review a source's suggestions inline on its transcript page.
  const handleReview = (sourceId: number) =>
    router.push(`/library/${sourceId}/transcript?review=1`);

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Left side: header + scrolling list. Shrinks when the panel opens. */}
      <div className="flex min-w-0 flex-1 flex-col">
        <PageHeader
          breadcrumbs={<Breadcrumbs items={[{ label: "Suggestions" }]} />}
          actions={
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-xs text-muted-foreground"
              onClick={refreshSuggestions}
              disabled={isFetching}
              aria-label="Refresh suggestions"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", isFetching && "animate-spin")} />
              Refresh
            </Button>
          }
        />

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-3xl space-y-5 px-4 py-6 md:px-8">
            <div className="space-y-1">
              <h1 className="text-2xl font-semibold tracking-tight">Suggestions</h1>
              <p className="text-sm text-muted-foreground">
                Root found things worth your review.
              </p>
            </div>

            {isLoading ? (
              <Skeleton className="h-24 rounded-xl" />
            ) : (
              <StatusSummaryCards counts={counts} active={filter} onSelect={handleFilter} />
            )}

            <FilterSortRow
              filter={filter}
              onFilterChange={handleFilter}
              counts={counts}
              sort={sort}
              onSortChange={handleSort}
            />

            {isLoading || (dismissedActive && dismissedLoading) ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-20 rounded-xl" />
                ))}
              </div>
            ) : visible.length === 0 ? (
              <EmptyState dismissed={dismissedActive} />
            ) : (
              <SuggestionsList suggestions={visible} onReview={handleReview} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ dismissed = false }: { dismissed?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-16 text-center">
      <CheckCircle2 className="h-8 w-8 text-muted-foreground/40" />
      <p className="text-sm text-muted-foreground">
        {dismissed ? "No dismissed suggestions." : "All caught up — nothing to review."}
      </p>
    </div>
  );
}

function parseEnum<T extends string>(value: string | null, valid: T[], fallback: T): T {
  return value && (valid as string[]).includes(value) ? (value as T) : fallback;
}

function sortSuggestions(
  items: SuggestionWithSource[],
  sort: SuggestionSort,
): SuggestionWithSource[] {
  const copy = [...items];
  if (sort === "oldest") {
    copy.sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
  } else if (sort === "confidence") {
    copy.sort((a, b) => (getSuggestionConfidence(b) ?? 0) - (getSuggestionConfidence(a) ?? 0));
  } else {
    copy.sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  }
  return copy;
}
