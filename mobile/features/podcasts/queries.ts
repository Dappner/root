import { useQuery } from "@tanstack/react-query";
import { podcastsApi } from "./api";
import { podcastsKeys } from "./query-keys";

const PODCASTS_STALE_TIME_MS = 5 * 60 * 1000;

export function usePodcastShows(limit = 50, offset = 0) {
  return useQuery({
    queryKey: [...podcastsKeys.shows(), { limit, offset }],
    queryFn: () => podcastsApi.listShows(limit, offset),
    staleTime: PODCASTS_STALE_TIME_MS,
  });
}

export function usePodcastShow(slug: string | null) {
  return useQuery({
    queryKey: podcastsKeys.show(slug ?? ""),
    queryFn: () => podcastsApi.getShow(slug!),
    enabled: !!slug,
    staleTime: PODCASTS_STALE_TIME_MS,
  });
}

export function usePodcastEpisodes(slug: string | null, limit = 50, offset = 0) {
  return useQuery({
    queryKey: [...podcastsKeys.episodes(slug ?? ""), { limit, offset }],
    queryFn: () => podcastsApi.listEpisodes(slug!, limit, offset),
    enabled: !!slug,
    staleTime: PODCASTS_STALE_TIME_MS,
  });
}

export function useTranscriptStatus(episodeId: number | null) {
  return useQuery({
    queryKey: podcastsKeys.transcriptStatus(episodeId ?? 0),
    queryFn: () => podcastsApi.getTranscriptStatus(episodeId!),
    enabled: !!episodeId,
    staleTime: 30_000,
  });
}

export function useTranscriptContent(episodeId: number | null, enabled: boolean) {
  return useQuery({
    queryKey: podcastsKeys.transcriptContent(episodeId ?? 0),
    queryFn: () => podcastsApi.getTranscriptContent(episodeId!),
    enabled: !!episodeId && enabled,
    staleTime: PODCASTS_STALE_TIME_MS,
  });
}
