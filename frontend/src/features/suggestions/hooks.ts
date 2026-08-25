"use client";

import { capturesKeys } from "@/features/captures/keys";
import { citationsKeys, sourcesKeys } from "@/features/sources/keys";
import { useSources } from "@/features/sources/hooks/sources";
import type { SourceDTO } from "@/features/sources/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { suggestionsApi, type CreateVoiceSuggestionInput } from "./api";
import { suggestionKeys } from "./keys";
import type {
  ApproveSuggestionRequest,
  SuggestionResponse,
  SuggestionWithSource,
} from "./types";

const PENDING_STATUSES = new Set<SuggestionResponse["status"]>([
  "uploaded",
  "processing",
  "ready",
  "failed",
]);

function isPendingSuggestion(suggestion: SuggestionResponse) {
  return PENDING_STATUSES.has(suggestion.status);
}

function attachSource(
  suggestion: SuggestionResponse,
  source?: SourceDTO,
): SuggestionWithSource {
  return {
    ...suggestion,
    source: source
      ? {
          id: source.id,
          title: source.title,
          type: source.type,
          image_url: source.image_url,
        }
      : undefined,
  };
}

export function useSourceSuggestions(sourceId: number, enabled = true) {
  return useQuery({
    queryKey: suggestionKeys.list(sourceId),
    queryFn: () => suggestionsApi.listSourceSuggestions(sourceId),
    enabled: enabled && !!sourceId,
    staleTime: 30_000,
  });
}

/** Poll cadence while suggestions are still being prepared server-side. */
const PROCESSING_POLL_MS = 10_000;

function hasInFlightSuggestion(suggestions: SuggestionResponse[] | undefined): boolean {
  return (suggestions ?? []).some(
    (s) => s.status === "uploaded" || s.status === "processing",
  );
}

export function usePendingSuggestions() {
  const sourcesQuery = useSources();
  const sources = sourcesQuery.data?.sources ?? [];
  const sourceMap = new Map(sources.map((source) => [source.id, source]));
  const suggestionsQuery = useQuery({
    queryKey: suggestionKeys.pending(),
    queryFn: () =>
      suggestionsApi.listSuggestions({
        statuses: ["uploaded", "processing", "ready", "failed"],
        limit: 20,
      }),
    staleTime: 30_000,
    // Poll only while something is still processing, so "processing → ready"
    // transitions surface live; stop once nothing is in flight to avoid idle
    // requests.
    refetchInterval: (query) =>
      hasInFlightSuggestion(query.state.data) ? PROCESSING_POLL_MS : false,
  });

  const suggestions = (suggestionsQuery.data ?? [])
    .filter(isPendingSuggestion)
    .map((suggestion) => attachSource(suggestion, sourceMap.get(suggestion.source_id)))
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));

  return {
    data: suggestions,
    isLoading: sourcesQuery.isLoading || suggestionsQuery.isLoading,
    isFetching: sourcesQuery.isFetching || suggestionsQuery.isFetching,
    isError: sourcesQuery.isError || suggestionsQuery.isError,
    error: sourcesQuery.error ?? suggestionsQuery.error,
  };
}

/**
 * Invalidate every suggestion-related query at once (pending, dismissed, and
 * per-source lists) plus the sources list the page joins against. Marking them
 * stale forces an immediate refetch of whatever is mounted and a fresh fetch on
 * next access for the rest — used by the page's Refresh button so a click
 * surfaces server-side changes instantly, not just the currently-visible tab.
 */
export function useRefreshSuggestions() {
  const queryClient = useQueryClient();

  return () => {
    void queryClient.invalidateQueries({ queryKey: suggestionKeys.all });
    void queryClient.invalidateQueries({ queryKey: sourcesKeys.list() });
  };
}

/**
 * Pending suggestions for a single source, driving inline review on the
 * transcript page. Fetches the source's OWN suggestions (not the global,
 * limit-20 inbox) so review mode sees them all regardless of how many pending
 * suggestions exist library-wide.
 */
export function useSourceReviewGroup(sourceId: number, enabled = true) {
  const sourcesQuery = useSources();
  const sourceDto = sourcesQuery.data?.sources.find((s) => s.id === sourceId);
  const { data, isLoading, isError, error } = useSourceSuggestions(sourceId, enabled);
  const suggestions = (data ?? [])
    .filter(isPendingSuggestion)
    .map((s) => attachSource(s, sourceDto))
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  const episodeId = suggestions.find((s) => s.episode_id != null)?.episode_id ?? null;
  return {
    suggestions,
    episodeId,
    source: suggestions[0]?.source,
    isLoading,
    isError,
    error,
  };
}

/**
 * Fetch dismissed suggestions lazily. Pass `enabled` so the (potentially large)
 * dismissed history only loads when the user actually opens the Dismissed tab.
 */
export function useDismissedSuggestions(enabled: boolean) {
  const sourcesQuery = useSources();
  const sources = sourcesQuery.data?.sources ?? [];
  const sourceMap = new Map(sources.map((source) => [source.id, source]));
  const suggestionsQuery = useQuery({
    queryKey: suggestionKeys.dismissed(),
    queryFn: () =>
      suggestionsApi.listSuggestions({ statuses: ["dismissed"], limit: 50 }),
    enabled,
    staleTime: 60_000,
  });

  const suggestions = (suggestionsQuery.data ?? [])
    .map((suggestion) => attachSource(suggestion, sourceMap.get(suggestion.source_id)))
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));

  return {
    data: suggestions,
    isLoading: enabled && (sourcesQuery.isLoading || suggestionsQuery.isLoading),
    isFetching: sourcesQuery.isFetching || suggestionsQuery.isFetching,
    isError: sourcesQuery.isError || suggestionsQuery.isError,
    error: sourcesQuery.error ?? suggestionsQuery.error,
  };
}

function useSuggestionMutationInvalidation() {
  const queryClient = useQueryClient();

  return (sourceId?: number) => {
    queryClient.invalidateQueries({ queryKey: suggestionKeys.all });
    if (sourceId) {
      queryClient.invalidateQueries({ queryKey: suggestionKeys.list(sourceId) });
      queryClient.invalidateQueries({ queryKey: citationsKeys.bySource(sourceId) });
      queryClient.invalidateQueries({ queryKey: capturesKeys.bySource(sourceId) });
      queryClient.invalidateQueries({ queryKey: sourcesKeys.detail(sourceId) });
    }
  };
}

export function useCreateVoiceSuggestion() {
  const invalidate = useSuggestionMutationInvalidation();

  return useMutation({
    mutationFn: (input: CreateVoiceSuggestionInput) => suggestionsApi.createVoiceSuggestion(input),
    onSuccess: (suggestion) => invalidate(suggestion.source_id),
  });
}

export function useApproveSuggestion() {
  const invalidate = useSuggestionMutationInvalidation();

  return useMutation({
    mutationFn: ({ suggestionId, payload }: {
      suggestionId: number;
      sourceId: number;
      payload: ApproveSuggestionRequest;
    }) => suggestionsApi.approveSuggestion(suggestionId, payload),
    onSuccess: (_data, variables) => invalidate(variables.sourceId),
  });
}

export function useDismissSuggestion() {
  const invalidate = useSuggestionMutationInvalidation();

  return useMutation({
    mutationFn: ({ suggestionId }: { suggestionId: number; sourceId: number }) =>
      suggestionsApi.dismissSuggestion(suggestionId),
    onSuccess: (_data, variables) => invalidate(variables.sourceId),
  });
}

export function useRetrySuggestion() {
  const queryClient = useQueryClient();
  const invalidate = useSuggestionMutationInvalidation();

  return useMutation({
    mutationFn: ({
      suggestionId,
      refinement,
    }: {
      suggestionId: number;
      sourceId: number;
      refinement?: string;
    }) => suggestionsApi.retrySuggestion(suggestionId, refinement),
    // Optimistically flip the retried suggestion to "processing" so it leaves
    // the Failed tab the instant the user clicks Retry — no waiting on the
    // POST + refetch. Reconciled by the onSettled invalidation below.
    onMutate: async ({ suggestionId }) => {
      await queryClient.cancelQueries({ queryKey: suggestionKeys.pending() });
      const previous = queryClient.getQueryData<SuggestionResponse[]>(
        suggestionKeys.pending(),
      );
      queryClient.setQueryData<SuggestionResponse[]>(
        suggestionKeys.pending(),
        (current) =>
          current?.map((s) =>
            s.id === suggestionId
              ? { ...s, status: "processing", error: undefined }
              : s,
          ),
      );
      return { previous };
    },
    onError: (_err, _variables, context) => {
      // Roll back to the pre-click snapshot so a failed retry doesn't strand the
      // item in a fake "processing" state.
      if (context?.previous) {
        queryClient.setQueryData(suggestionKeys.pending(), context.previous);
      }
    },
    onSettled: (_data, _err, variables) => invalidate(variables.sourceId),
  });
}
