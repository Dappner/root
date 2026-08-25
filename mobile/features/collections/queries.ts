import { useQuery } from "@tanstack/react-query";
import { getCollection, listCollections, listCollectionSources } from "@/lib/api/rag-generated";
import { collectionsKeys } from "./query-keys";

const COLLECTIONS_STALE_TIME_MS = 2 * 60 * 1000;

export function useCollections() {
  return useQuery({
    queryKey: collectionsKeys.list(),
    queryFn: async () => {
      const res = await listCollections();
      if (res.status !== 200) throw new Error("Failed to load collections");
      return res.data;
    },
    staleTime: COLLECTIONS_STALE_TIME_MS,
  });
}

export function useCollection(id: number | null) {
  return useQuery({
    queryKey: collectionsKeys.detail(id ?? 0),
    queryFn: async () => {
      const res = await getCollection(id!);
      if (res.status !== 200) throw new Error("Failed to load collection");
      return res.data;
    },
    enabled: !!id,
    staleTime: COLLECTIONS_STALE_TIME_MS,
  });
}

export function useCollectionSourceIds(id: number | null) {
  return useQuery({
    queryKey: collectionsKeys.sources(id ?? 0),
    queryFn: async () => {
      const res = await listCollectionSources(id!);
      if (res.status !== 200) throw new Error("Failed to load collection sources");
      return res.data.source_ids ?? [];
    },
    enabled: !!id,
    staleTime: COLLECTIONS_STALE_TIME_MS,
  });
}
