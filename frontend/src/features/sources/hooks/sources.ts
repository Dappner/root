"use client";

import { podcastsKeys } from "@/features/podcasts/keys";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { enrichSource, sourcesApi } from "../api";
import { sourcesKeys } from "../keys";
import type {
  PodcastImportRequest,
  ShowDTO,
  SourceDTO,
  SourceType,
  SourcesListResponse,
  UpdateSourceRequest,
  UpdateSourceSummariesRequest,
} from "../types";
import { SourceDTOStatus } from "../types";

export function useSources(type?: SourceType) {
  return useQuery({
    queryKey: sourcesKeys.list(),
    queryFn: () => sourcesApi.getSources(),
    staleTime: 5 * 60 * 1000,
    select: (data) => filterSources(data, type),
  });
}

export function useSource(id: number) {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: sourcesKeys.detail(id),
    queryFn: () => sourcesApi.getSource(id),
    enabled: !!id,
    initialData: () => {
      const cached = queryClient.getQueryData<{ sources: SourceDTO[] }>(
        sourcesKeys.list(),
      );
      return cached?.sources?.find((s) => s.id === id);
    },
    staleTime: 5_000,
  });
}

export function useCreateSource() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: sourcesApi.createSource,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sourcesKeys.list() });
    },
  });
}

export function useEnrichSource() {
  return useMutation({
    mutationFn: async (url: string) => {
      const response = await enrichSource({ url });
      if (response.status !== 200 || !response.data) {
        throw new Error(
          `Failed to enrich source metadata from URL. Status: ${response.status}`,
        );
      }
      return response.data;
    },
  });
}

export function useUpdateSource() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateSourceRequest }) =>
      sourcesApi.updateSource(id, data),
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: sourcesKeys.detail(id) });

      const previousDetail = queryClient.getQueryData<SourceDTO>(
        sourcesKeys.detail(id),
      );

      queryClient.setQueryData<SourceDTO>(sourcesKeys.detail(id), (old) => {
        if (!old) return old;
        const updated: SourceDTO = { ...old };
        for (const [key, value] of Object.entries(data)) {
          if (value !== undefined) {
            (updated as unknown as Record<string, unknown>)[key] = value;
          }
        }
        return updated;
      });

      return { previousDetail };
    },
    onError: (_error, variables, context) => {
      if (context?.previousDetail) {
        queryClient.setQueryData(
          sourcesKeys.detail(variables.id),
          context.previousDetail,
        );
      }
    },
    onSuccess: (updatedSource, variables) => {
      // Update detail cache with server response
      queryClient.setQueryData<SourceDTO>(
        sourcesKeys.detail(variables.id),
        updatedSource,
      );
      // Invalidate list cache to refetch and ensure consistency
      queryClient.invalidateQueries({ queryKey: sourcesKeys.list() });
    },
  });
}

export function useDeleteSource() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: sourcesApi.deleteSource,
    onSuccess: (_, deletedId) => {
      // Remove from list cache
      queryClient.setQueryData<SourcesListResponse>(
        sourcesKeys.list(),
        (old) => {
          if (!old) return old;
          const remainingSources = old?.sources?.filter(
            (s) => s.id !== deletedId,
          );

          // Recalculate counts
          const counts = remainingSources?.reduce(
            (acc, s) => {
              acc.all += 1;
              if (s.type === "book") acc.book += 1;
              else if (s.type === "article") acc.article += 1;
              else if (s.type === "video") acc.video += 1;
              else if (s.type === "podcast") acc.podcast += 1;
              else if (s.type === "pdf") acc.pdf += 1;
              return acc;
            },
            { all: 0, book: 0, article: 0, video: 0, podcast: 0, pdf: 0 },
          );

          return {
            sources: remainingSources,
            metadata: { counts },
          };
        },
      );

      // Remove detail cache
      queryClient.removeQueries({ queryKey: sourcesKeys.detail(deletedId) });
    },
  });
}

function applyStatusPatch(
  queryClient: ReturnType<typeof useQueryClient>,
  sourceId: number,
  patch: Partial<SourceDTO>,
) {
  queryClient.setQueryData<SourceDTO>(sourcesKeys.detail(sourceId), (old) =>
    old ? { ...old, ...patch } : old,
  );
  queryClient.setQueryData<SourcesListResponse>(sourcesKeys.list(), (old) => {
    if (!old) return old;
    return {
      ...old,
      sources: old.sources?.map((s) =>
        s.id === sourceId ? { ...s, ...patch } : s,
      ),
    };
  });
}

/**
 * Single source lifecycle transition. Replaces the former six per-direction
 * hooks (start / revert-to-todo / reflect / revert-to-in-progress / complete /
 * revert-to-reflecting) now that the backend exposes one PATCH endpoint that
 * enforces the legal transition graph. The cache is reconciled from the
 * authoritative lifecycle fields the endpoint returns.
 */
export function useTransitionSource() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: number; status: SourceDTOStatus }) =>
      sourcesApi.transitionStatus(id, status),
    onSuccess: (result) => {
      applyStatusPatch(queryClient, result.id, {
        status: result.status as SourceDTOStatus,
        started_at: result.started_at ?? undefined,
        reflecting_at: result.reflecting_at ?? undefined,
        completed_at: result.completed_at ?? undefined,
        last_active_at: result.last_active_at ?? undefined,
        updated_at: result.updated_at,
      });
    },
  });
}

export function useImportPodcast() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: PodcastImportRequest): Promise<ShowDTO> =>
      sourcesApi.importPodcast(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sourcesKeys.list() });
      queryClient.invalidateQueries({ queryKey: podcastsKeys.all });
    },
  });
}

export function useUpdateSourceSummaries() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: number;
      data: UpdateSourceSummariesRequest;
    }) => sourcesApi.updateSourceSummaries(id, data),
    onSuccess: (updatedSource, variables) => {
      // Update detail cache - merge with existing source
      queryClient.setQueryData<SourceDTO>(
        sourcesKeys.detail(variables.id),
        (old) =>
          old
            ? { ...old, summary_long: updatedSource.summary_long || undefined }
            : old,
      );

      // Update list cache - merge with existing source
      queryClient.setQueryData<SourcesListResponse>(
        sourcesKeys.list(),
        (old) => {
          if (!old) return old;
          return {
            ...old,
            sources: old?.sources?.map((s) =>
              s.id === updatedSource.id
                ? {
                    ...s,
                    summary_long: updatedSource.summary_long || undefined,
                  }
                : s,
            ),
          };
        },
      );
    },
  });
}

function filterSources(
  data: SourcesListResponse,
  type?: string,
): SourcesListResponse {
  if (!type) return data;
  return {
    ...data,
    sources: data.sources?.filter((s) => s.type === type) ?? [],
  } satisfies SourcesListResponse;
}
