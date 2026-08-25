import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { homeKeys } from "@/features/home/hooks";
import { capturesApi } from "./api";
import type { UpdateCaptureRequest } from "./types";
import { capturesKeys } from "./keys";
import { useQuery } from "@tanstack/react-query";

export function useCreateCapture() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: capturesKeys.all,
    mutationFn: capturesApi.createCapture,
    onSuccess: (response) => {
      const capture = response.capture;
      if (capture?.source_id) {
        queryClient.invalidateQueries({ queryKey: capturesKeys.bySource(capture.source_id) });
      }
      queryClient.invalidateQueries({ queryKey: homeKeys.all });
      if (response.source_started) {
        toast.success("Moved to In progress");
      }
    },
  });
}

export function useCapturesBySource(sourceId: number) {
  return useQuery({
    queryKey: capturesKeys.bySource(sourceId),
    queryFn: () => capturesApi.getBySource(sourceId),
    enabled: !!sourceId,
    retry: 1,
    staleTime: 30 * 1000, // 30 seconds
  });
}

// Derives the captures attached to a single citation from the per-source query
// so we share one cache instead of fetching per citation. The dialog always
// knows the sourceId (citations carry source_id), so this is free.
export function useCapturesByCitation(sourceId: number, citationId: number) {
  const query = useCapturesBySource(sourceId);
  const captures = (query.data ?? [])
    .filter((c) => c.citation_id === citationId)
    .sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );
  return { ...query, data: captures };
}

interface UpdateCaptureVariables {
  id: number;
  data: UpdateCaptureRequest;
}

export function useUpdateCapture() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: capturesKeys.all,
    mutationFn: ({ id, data }: UpdateCaptureVariables) =>
      capturesApi.updateCapture(id, data),
    onSuccess: (capture) => {
      // TODO: If source_id changes, we don't invalidate the previous source cache.
      // Consider tracking previousSourceId or invalidating broader keys.
      if (capture.source_id) {
        queryClient.invalidateQueries({ queryKey: capturesKeys.bySource(capture.source_id) });
      }
    },
  });
}

interface DeleteCaptureVariables {
  id: number;
  sourceId?: number | null;
}

export function useDeleteCapture() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: capturesKeys.all,
    mutationFn: ({ id }: DeleteCaptureVariables) => capturesApi.deleteCapture(id),
    onSuccess: (_data, { sourceId }) => {
      if (sourceId) {
        queryClient.invalidateQueries({ queryKey: capturesKeys.bySource(sourceId) });
      }
    },
  });
}
