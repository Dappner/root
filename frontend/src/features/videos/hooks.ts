import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect } from "react";
import { sourcesKeys as sourceKeys } from "../sources/keys";
import * as api from "./api";
import { channelKeys, videoKeys } from "./keys";

export function useVideo(videoId: number | undefined) {
  return useQuery({
    queryKey: videoKeys.detail(videoId!),
    queryFn: () => api.getVideo(videoId!),
    enabled: !!videoId,
  });
}

export function useImportVideo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.importVideo,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: videoKeys.all });
      queryClient.invalidateQueries({ queryKey: channelKeys.all });
    },
  });
}

export function useAddVideoToLibrary() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.addVideoToLibrary,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sourceKeys.all });
    },
  });
}

// ============================================================================
// Transcript Hooks
// ============================================================================

export function useVideoTranscriptStatus(videoId: number | undefined) {
  return useQuery({
    queryKey: videoKeys.transcriptStatus(videoId!),
    queryFn: () => api.getVideoTranscriptStatus(videoId!),
    enabled: !!videoId,
    refetchInterval: (query) => {
      // Poll while pending
      const status = query.state.data?.status;
      return status === "pending" ? 3000 : false;
    },
  });
}

export function useVideoTranscriptContent(videoId: number | undefined) {
  return useQuery({
    queryKey: videoKeys.transcript(videoId!),
    queryFn: () => api.getVideoTranscriptContent(videoId!),
    enabled: !!videoId,
  });
}

export function useGenerateVideoTranscript() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.generateVideoTranscript,
    onSuccess: (_, videoId) => {
      queryClient.invalidateQueries({
        queryKey: videoKeys.transcriptStatus(videoId),
      });
      queryClient.invalidateQueries({ queryKey: videoKeys.detail(videoId) });
    },
  });
}

/**
 * Combined hook for video transcript with auto-polling and content fetching
 */
export function useVideoTranscript(videoId: number | undefined) {
  const statusQuery = useVideoTranscriptStatus(videoId);
  const contentQuery = useVideoTranscriptContent(videoId);
  const generateMutation = useGenerateVideoTranscript();

  const status = statusQuery.data?.status || "none";
  const isCompleted = status === "transcribed" || status === "embedded";
  const isPending = status === "pending";
  const isFailed = status === "failed";

  // Fetch content when status becomes transcribed or embedded
  useEffect(() => {
    if (isCompleted && videoId) {
      contentQuery.refetch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCompleted, videoId]);

  const generate = useCallback(() => {
    if (videoId) {
      generateMutation.mutate(videoId);
    }
  }, [videoId, generateMutation]);

  return {
    status,
    isCompleted,
    isPending,
    isFailed,
    content: contentQuery.data,
    contentIsLoading: contentQuery.isLoading,
    contentError: contentQuery.error,
    generate,
    isGenerating: generateMutation.isPending,
    generateError: generateMutation.error,
    statusIsLoading: statusQuery.isLoading,
  };
}
