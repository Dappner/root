"use client";

import { capturesApi } from "@/features/captures/api";
import { capturesKeys } from "@/features/captures/keys";
import { takeawaysApi } from "@/features/takeaways/api";
import { takeawaysKeys } from "@/features/takeaways/keys";
import { useQuery } from "@tanstack/react-query";
import { citationsApi, sectionsApi } from "../api";
import { citationsKeys, sourcesKeys } from "../keys";
import { groupHighlightsBySection } from "../utils/grouping";

/**
 * Aggregates sections, citations, captures, and takeaways using parallel queries.
 * This replaces the monolithic highlights query for better cache granularity.
 * Takeaways are fetched in parallel and used to enrich citations on the client side.
 */
export function useGroupedHighlights(sourceId: number) {
  // Fetch all four data sources in parallel
  const sectionsQuery = useQuery({
    queryKey: sourcesKeys.sections(sourceId),
    queryFn: () => sectionsApi.getSections(sourceId),
    enabled: !!sourceId,
  });

  const citationsQuery = useQuery({
    queryKey: citationsKeys.bySource(sourceId),
    queryFn: () => citationsApi.getCitationsBySource(sourceId),
    enabled: !!sourceId,
  });

  const capturesQuery = useQuery({
    queryKey: capturesKeys.bySource(sourceId),
    queryFn: () => capturesApi.getBySource(sourceId),
    enabled: !!sourceId,
  });

  const takeawaysQuery = useQuery({
    queryKey: takeawaysKeys.list(sourceId),
    queryFn: () => takeawaysApi.getTakeaways(sourceId),
    enabled: !!sourceId,
  });

  // Show loading state until all queries have completed at least one attempt
  // This prevents flickering as individual queries complete at different speeds
  const isLoading =
    sectionsQuery.isLoading ||
    citationsQuery.isLoading ||
    capturesQuery.isLoading ||
    takeawaysQuery.isLoading;

  // Aggregate errors for better debugging
  const isError =
    sectionsQuery.isError ||
    citationsQuery.isError ||
    capturesQuery.isError ||
    takeawaysQuery.isError;
  const errors = [
    sectionsQuery.error,
    citationsQuery.error,
    capturesQuery.error,
    takeawaysQuery.error,
  ].filter(Boolean);
  const error = errors.length > 0 ? errors[0] : null;

  // Determine if we should attempt to group data
  // We group once all queries have completed their initial fetch (success or error)
  const hasAttemptedLoad =
    !sectionsQuery.isLoading &&
    !citationsQuery.isLoading &&
    !capturesQuery.isLoading &&
    !takeawaysQuery.isLoading;

  // Group the data when queries have attempted to load (use empty arrays for failed/missing queries)
  // This allows partial results to be displayed even if one query fails
  const data = hasAttemptedLoad
    ? groupHighlightsBySection({
        sections: sectionsQuery.data ?? [],
        citations: citationsQuery.data ?? [],
        captures: capturesQuery.data ?? [],
        takeaways: takeawaysQuery.data ?? [],
      })
    : undefined;

  return {
    data,
    isLoading,
    isError,
    error,
    // Pass through individual query states for fine-grained control if needed
    sectionsQuery,
    citationsQuery,
    capturesQuery,
    takeawaysQuery,
  };
}
