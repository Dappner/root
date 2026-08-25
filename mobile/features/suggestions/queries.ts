import { useQuery } from "@tanstack/react-query";
import { suggestionsApi } from "./api";
import { suggestionsKeys } from "./query-keys";

export function useSourceSuggestions(sourceId: number | null) {
  return useQuery({
    queryKey: suggestionsKeys.source(sourceId ?? 0),
    queryFn: () => suggestionsApi.listForSource(sourceId!),
    enabled: !!sourceId,
    staleTime: 30_000,
  });
}
