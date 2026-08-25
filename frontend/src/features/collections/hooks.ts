import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { collectionsApi } from "./api";
import { collectionsKeys } from "./keys";
import type { CollectionDTO, CreateCollectionRequest, UpdateCollectionRequest } from "./types";

export function useCollections() {
  return useQuery({
    queryKey: collectionsKeys.list(),
    queryFn: collectionsApi.getCollections,
  });
}

export function useCollection(id: number) {
  return useQuery({
    queryKey: collectionsKeys.detail(id),
    queryFn: () => collectionsApi.getCollection(id),
    enabled: !!id,
  });
}

export function useCollectionSourceIDs(id: number) {
  return useQuery({
    queryKey: collectionsKeys.sources(id),
    queryFn: () => collectionsApi.getCollectionSourceIDs(id),
    enabled: !!id,
  });
}

export function useCreateCollection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateCollectionRequest) => collectionsApi.createCollection(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: collectionsKeys.lists() });
    },
  });
}

export function useUpdateCollection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateCollectionRequest }) =>
      collectionsApi.updateCollection(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: collectionsKeys.lists() });
      queryClient.invalidateQueries({ queryKey: collectionsKeys.detail(variables.id) });
    },
  });
}

export function useDeleteCollection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => collectionsApi.deleteCollection(id),
    onMutate: async (id) => {
      const previousList = queryClient.getQueryData<CollectionDTO[]>(collectionsKeys.list());

      queryClient.setQueryData<CollectionDTO[]>(
        collectionsKeys.list(),
        (old) => old?.filter((c) => c.id !== id),
      );

      return { previousList };
    },
    onError: (_error, _id, context) => {
      if (context?.previousList) {
        queryClient.setQueryData(collectionsKeys.list(), context.previousList);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: collectionsKeys.lists() });
    },
  });
}

export function useAddSourceToCollection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ collectionId, sourceId }: { collectionId: number; sourceId: number }) =>
      collectionsApi.addSourceToCollection(collectionId, sourceId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: collectionsKeys.sources(variables.collectionId) });
      queryClient.invalidateQueries({ queryKey: collectionsKeys.detail(variables.collectionId) });
      queryClient.invalidateQueries({ queryKey: collectionsKeys.lists() });
    },
  });
}

export function useRemoveSourceFromCollection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ collectionId, sourceId }: { collectionId: number; sourceId: number }) =>
      collectionsApi.removeSourceFromCollection(collectionId, sourceId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: collectionsKeys.sources(variables.collectionId) });
      queryClient.invalidateQueries({ queryKey: collectionsKeys.detail(variables.collectionId) });
      queryClient.invalidateQueries({ queryKey: collectionsKeys.lists() });
    },
  });
}
