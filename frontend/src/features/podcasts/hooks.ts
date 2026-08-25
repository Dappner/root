"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { podcastsApi } from "../sources/api";
import { transcriptApi } from "./transcript-api";
import { podcastsKeys } from "./keys";
import type { AddToLibraryRequest } from "./types";

export function usePodcastShow(url: string | null) {
  return useQuery({
    queryKey: podcastsKeys.show(url || ""),
    queryFn: () => podcastsApi.getShow(url!),
    enabled: !!url,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function usePodcastShows(limit: number = 50, offset: number = 0) {
  return useQuery({
    queryKey: [...podcastsKeys.shows(), { limit, offset }],
    queryFn: () => podcastsApi.listShows(limit, offset),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function usePodcastEpisodes(
  url: string | null,
  limit: number = 50,
  offset: number = 0,
) {
  return useQuery({
    queryKey: [...podcastsKeys.episodes(url || ""), { limit, offset }],
    queryFn: () => podcastsApi.listEpisodes(url!, limit, offset),
    enabled: !!url,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useSyncPodcastShow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => podcastsApi.syncShow(id),
    onSuccess: async (data, id) => {
      // Use refetchQueries instead of invalidateQueries for better control
      // This prevents cancellation errors during concurrent renders
      await queryClient.refetchQueries({
        queryKey: podcastsKeys.show(id),
        type: "active", // Only refetch active queries
      });
      await queryClient.refetchQueries({
        queryKey: podcastsKeys.episodes(id),
        type: "active",
      });
    },
  });
}

export function useAddPodcastToLibrary() {
  return useMutation({
    mutationFn: (data: AddToLibraryRequest) => podcastsApi.addToLibrary(data),
  });
}

export function useEpisodeAudioUrl(episodeId: number, hasR2Key: boolean) {
  return useQuery({
    queryKey: podcastsKeys.audioUrl(episodeId),
    queryFn: () => transcriptApi.getAudioUrl(episodeId),
    enabled: hasR2Key,
    staleTime: 5 * 60 * 1000, // 5 minutes — well within presigned URL validity
  });
}
