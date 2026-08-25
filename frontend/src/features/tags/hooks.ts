import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { tagsApi } from "./api";
import { tagsKeys } from "./keys";
import type {
  CreateTagRequest,
  TagDTO,
  UpdateTagRequest,
} from "@/features/tags/types";

export function useTags() {
  return useQuery({
    queryKey: tagsKeys.lists(),
    queryFn: tagsApi.getTags,
  });
}

export function useTag(id: number) {
  return useQuery({
    queryKey: tagsKeys.detail(id),
    queryFn: () => tagsApi.getTag(id),
    enabled: !!id,
  });
}

export function useCreateTag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateTagRequest) => tagsApi.createTag(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tagsKeys.lists() });
    },
  });
}

export function useUpdateTag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateTagRequest }) =>
      tagsApi.updateTag(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: tagsKeys.lists() });
      queryClient.invalidateQueries({
        queryKey: tagsKeys.detail(variables.id),
      });
    },
  });
}

export function useDeleteTag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => tagsApi.deleteTag(id),
    onMutate: async (id) => {
      const previousList = queryClient.getQueryData<TagDTO[]>(tagsKeys.lists());

      queryClient.setQueryData<TagDTO[]>(
        tagsKeys.lists(),
        (old) => old?.filter((tag) => tag.id !== id),
      );

      return { previousList };
    },
    onError: (_error, _id, context) => {
      if (context?.previousList) {
        queryClient.setQueryData(tagsKeys.lists(), context.previousList);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: tagsKeys.lists() });
    },
  });
}
