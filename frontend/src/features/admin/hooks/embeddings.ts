"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { embeddingsApi } from "../api";
import { adminKeys } from "../keys";

export function useStaleEmbeddingsCount(userId: string) {
  return useQuery({
    queryKey: adminKeys.staleEmbeddingsCount(userId),
    queryFn: () => embeddingsApi.getStaleCount(userId),
    enabled: !!userId,
    staleTime: 30 * 1000, // 30 seconds - refresh more frequently
  });
}

export function useProcessStaleEmbeddings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      userId,
      limit = 200,
    }: {
      userId: string;
      limit?: number;
    }) => embeddingsApi.processStale(userId, limit),
    onSuccess: (_, variables) => {
      // Invalidate the stale count query to refresh the count
      queryClient.invalidateQueries({
        queryKey: adminKeys.staleEmbeddingsCount(variables.userId),
      });
    },
  });
}
