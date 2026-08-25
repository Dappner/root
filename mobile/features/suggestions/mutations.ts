import { sourcesKeys } from "@/features/sources/hooks";
import type { ApproveSuggestionRequest } from "@/lib/api/rag-generated";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { suggestionsApi, type CreateVoiceSuggestionInput } from "./api";
import { suggestionsKeys } from "./query-keys";

export function useCreateVoiceSuggestion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateVoiceSuggestionInput) => suggestionsApi.createVoice(input),
    onSuccess: (suggestion) => {
      queryClient.invalidateQueries({
        queryKey: suggestionsKeys.source(suggestion.source_id),
      });
    },
  });
}

export function useApproveSuggestion(sourceId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload?: ApproveSuggestionRequest["payload"] }) =>
      suggestionsApi.approve(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: suggestionsKeys.source(sourceId) });
      queryClient.invalidateQueries({ queryKey: sourcesKeys.detail(sourceId) });
      queryClient.invalidateQueries({ queryKey: sourcesKeys.citations(sourceId) });
      queryClient.invalidateQueries({ queryKey: sourcesKeys.captures(sourceId) });
    },
  });
}

export function useDismissSuggestion(sourceId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => suggestionsApi.dismiss(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: suggestionsKeys.source(sourceId) });
    },
  });
}

export function useRetrySuggestion(sourceId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => suggestionsApi.retry(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: suggestionsKeys.source(sourceId) });
    },
  });
}
