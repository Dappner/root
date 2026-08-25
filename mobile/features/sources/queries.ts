import { useQuery } from "@tanstack/react-query";
import { listDownloadedSources, readSourceMeta } from "@/features/offline/backends/fs/sources";
import { sourcesApi } from "./api";
import { sourcesKeys } from "./query-keys";

export function useSources() {
  return useQuery({
    queryKey: sourcesKeys.list(),
    queryFn: async () => {
      try {
        return await sourcesApi.listSources();
      } catch (err) {
        // Offline fallback: return downloaded sources so the library
        // still renders something playable on a flight.
        const local = listDownloadedSources().map((m) => m.source);
        if (local.length === 0) throw err;
        return local;
      }
    },
  });
}

export function useSource(id: number | null) {
  return useQuery({
    queryKey: sourcesKeys.detail(id ?? 0),
    queryFn: () => sourcesApi.getSource(id!),
    enabled: !!id,
    initialData: () => (id ? readSourceMeta(id)?.source ?? undefined : undefined),
  });
}

export function useSourceSections(id: number | null) {
  return useQuery({
    queryKey: sourcesKeys.sections(id ?? 0),
    queryFn: () => sourcesApi.getSections(id!),
    enabled: !!id,
  });
}

export function useSourceCitations(id: number | null) {
  return useQuery({
    queryKey: sourcesKeys.citations(id ?? 0),
    queryFn: () => sourcesApi.getCitations(id!),
    enabled: !!id,
  });
}

export function useSourceCaptures(id: number | null) {
  return useQuery({
    queryKey: sourcesKeys.captures(id ?? 0),
    queryFn: () => sourcesApi.getCaptures(id!),
    enabled: !!id,
  });
}

export function useSourceTakeaways(id: number | null) {
  return useQuery({
    queryKey: sourcesKeys.takeaways(id ?? 0),
    queryFn: () => sourcesApi.getTakeaways(id!),
    enabled: !!id,
  });
}
