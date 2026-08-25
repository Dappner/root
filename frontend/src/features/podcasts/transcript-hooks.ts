"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { transcriptApi } from "./transcript-api";
import { podcastsKeys } from "./keys";
import type { BackfillSectionsRequest, GenerateTranscriptRequest } from "./types";

export function useGenerateTranscript() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: GenerateTranscriptRequest) => transcriptApi.generate(request),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: podcastsKeys.transcript(variables.episode_id),
      });
    },
  });
}

export function useTranscriptStatus(episodeId: number, enabled: boolean = true) {
  return useQuery({
    queryKey: podcastsKeys.transcript(episodeId),
    queryFn: () => transcriptApi.getStatus(episodeId),
    enabled: enabled && !!episodeId,
    refetchInterval: (query) => {
      const status = query.state?.data?.status;
      return status === "pending" ? 2000 : false; // Poll every 2s while pending
    },
  });
}

export function useEmbedTranscript(episodeId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => transcriptApi.embed(episodeId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: podcastsKeys.transcript(episodeId),
      });
    },
  });
}

export function useBackfillSections() {
  return useMutation({
    mutationFn: (request: BackfillSectionsRequest) => transcriptApi.backfillSections(request),
  });
}

export function useBackfillCitationSections() {
  return useMutation({
    mutationFn: () => transcriptApi.backfillCitationSections(),
  });
}

export function useTranscriptContent(episodeId: number, enabled: boolean = true) {
  return useQuery({
    queryKey: podcastsKeys.transcriptContent(episodeId),
    queryFn: () => transcriptApi.getContent(episodeId),
    enabled: enabled && !!episodeId,
    staleTime: 1000 * 60 * 60, // 1 hour - transcripts don't change often
  });
}
