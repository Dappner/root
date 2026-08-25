import { sourcesKeys } from "@/features/sources/hooks";
import { homeKeys } from "@/features/home/hooks";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { podcastsApi } from "./api";
import type { AddToLibraryRequest } from "./types";
import { podcastsKeys } from "./query-keys";

export function useAddToLibrary() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: AddToLibraryRequest) => podcastsApi.addToLibrary(data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: sourcesKeys.all });
      queryClient.invalidateQueries({ queryKey: homeKeys.all });
      queryClient.invalidateQueries({ queryKey: podcastsKeys.transcriptStatus(variables.episode_id) });
    },
  });
}
