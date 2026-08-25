import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert } from "react-native";
import { readLocalTranscript } from "./context";
import { useOfflineStore } from "@/features/offline";
import { useTranscriptContent, useTranscriptStatus } from "@/features/podcasts/hooks";
import { generateTranscriptRagApiTranscriptGeneratePost } from "@/lib/api/rag-generated";
import type { TranscriptData } from "@/lib/api/rag-generated";

interface UsePlayerTranscriptArgs {
  sourceId: number | null | undefined;
  episodeId: number | null | undefined;
  enabled: boolean;
}

interface UsePlayerTranscriptResult {
  transcript: TranscriptData | null;
  transcriptLoading: boolean;
  transcriptProcessing: boolean;
  triggering: boolean;
  triggerGeneration: () => Promise<void>;
}

export function usePlayerTranscript({
  sourceId,
  episodeId,
  enabled,
}: UsePlayerTranscriptArgs): UsePlayerTranscriptResult {
  const offline = useOfflineStore();

  const localTranscript = useMemo(
    () => (sourceId ? readLocalTranscript(sourceId) : null),
    [sourceId]
  );

  const { data: transcriptStatus } = useTranscriptStatus(
    enabled && !localTranscript ? (episodeId ?? null) : null
  );
  const transcriptReady =
    transcriptStatus?.status === "transcribed" || transcriptStatus?.status === "embedded";
  const { data: remoteTranscript, isLoading: transcriptLoading } = useTranscriptContent(
    enabled && !localTranscript ? (episodeId ?? null) : null,
    transcriptReady
  );
  const transcript = localTranscript ?? remoteTranscript ?? null;
  const transcriptProcessing = transcriptStatus?.status === "pending";

  useEffect(() => {
    if (!sourceId || !remoteTranscript || localTranscript) return;
    offline.saveLocalTranscript(sourceId, remoteTranscript);
  }, [sourceId, remoteTranscript, localTranscript, offline]);

  const [triggering, setTriggering] = useState(false);
  const triggerGeneration = useCallback(async () => {
    if (!episodeId) return;
    setTriggering(true);
    try {
      await generateTranscriptRagApiTranscriptGeneratePost({ episode_id: episodeId });
      Alert.alert("Processing", "Transcript generation started. Check back in a few minutes.");
    } catch {
      Alert.alert("Error", "Could not start transcript generation.");
    } finally {
      setTriggering(false);
    }
  }, [episodeId]);

  return {
    transcript,
    transcriptLoading,
    transcriptProcessing,
    triggering,
    triggerGeneration,
  };
}
