import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { takeawaysApi } from "./api";
import { takeawaysKeys } from "./keys";
import { sourcesKeys } from "@/features/sources/keys";
import type {
  CreateSourceTakeawayRequest,
  UpdateSourceTakeawayRequest,
} from "@/features/takeaways/types";

export function useTakeaways(sourceId: number) {
  return useQuery({
    queryKey: takeawaysKeys.list(sourceId),
    queryFn: () => takeawaysApi.getTakeaways(sourceId),
    enabled: !!sourceId,
  });
}

export function useTakeaway(sourceId: number, takeawayId: number) {
  return useQuery({
    queryKey: takeawaysKeys.detail(sourceId, takeawayId),
    queryFn: () => takeawaysApi.getTakeaway(sourceId, takeawayId),
    enabled: !!sourceId && !!takeawayId,
  });
}

export function useTakeawayParallels(takeawayId: number) {
  return useQuery({
    queryKey: takeawaysKeys.parallels(takeawayId),
    queryFn: () => takeawaysApi.getParallels(takeawayId),
    // ANN query is cheap but parallels rarely change minute-to-minute. Stale
    // window matches the cadence at which the user might add/edit takeaways
    // in another tab and expect the panel to refresh on revisit.
    staleTime: 2 * 60 * 1000,
  });
}

export function useCreateTakeaway() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      sourceId,
      data,
    }: {
      sourceId: number;
      data: CreateSourceTakeawayRequest;
    }) => takeawaysApi.createTakeaway(sourceId, data),
    onSuccess: (_, variables) => {
      // Invalidate takeaways list for this source
      queryClient.invalidateQueries({
        queryKey: takeawaysKeys.list(variables.sourceId),
      });
      // Also invalidate source details (to update counts)
      queryClient.invalidateQueries({
        queryKey: sourcesKeys.detail(variables.sourceId),
      });
    },
  });
}

export function useUpdateTakeaway() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      sourceId,
      takeawayId,
      data,
    }: {
      sourceId: number;
      takeawayId: number;
      data: UpdateSourceTakeawayRequest;
    }) => takeawaysApi.updateTakeaway(sourceId, takeawayId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: takeawaysKeys.list(variables.sourceId),
      });
      queryClient.invalidateQueries({
        queryKey: takeawaysKeys.detail(variables.sourceId, variables.takeawayId),
      });
    },
  });
}

export function useDeleteTakeaway() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      sourceId,
      takeawayId,
    }: {
      sourceId: number;
      takeawayId: number;
    }) => takeawaysApi.deleteTakeaway(sourceId, takeawayId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: takeawaysKeys.list(variables.sourceId),
      });
      queryClient.invalidateQueries({
        queryKey: sourcesKeys.detail(variables.sourceId),
      });
    },
  });
}
