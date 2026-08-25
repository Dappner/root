import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert } from "react-native";
import { readLocalTranscript } from "@/features/player/context";
import { useOfflineStore } from "@/features/offline";
import { useTranscriptContent, useTranscriptStatus } from "@/features/podcasts/hooks";
import { generateTranscriptRagApiTranscriptGeneratePost } from "@/lib/api/rag-generated";
import type { SourceDTO } from "../api";
import { useTranscriptHighlights, type CitationWithCapture } from "../hooks";
import type {
  CaptureDTO,
  CitationResponse as CitationDTO,
} from "@/lib/api/rag-generated";

export function useSourceTranscript(
  source: SourceDTO | undefined | null,
  citations: CitationDTO[],
  captures: CaptureDTO[],
) {
  const offline = useOfflineStore();
  const isAV = source?.episode_id != null;

  const localTranscript = useMemo(
    () => (source?.id ? readLocalTranscript(source.id) : null),
    [source?.id]
  );

  const { data: transcriptStatus } = useTranscriptStatus(
    isAV && !localTranscript ? (source?.episode_id ?? null) : null
  );
  const transcriptReady =
    transcriptStatus?.status === "transcribed" || transcriptStatus?.status === "embedded";
  const { data: remoteTranscript, isLoading: transcriptLoading } = useTranscriptContent(
    isAV && !localTranscript ? (source?.episode_id ?? null) : null,
    transcriptReady
  );
  const transcript = localTranscript ?? remoteTranscript ?? null;
  const transcriptProcessing = transcriptStatus?.status === "pending";

  const { citationsByUtteranceIdx } = useTranscriptHighlights(citations, captures, transcript);

  useEffect(() => {
    if (!source?.id || !remoteTranscript || localTranscript) return;
    offline.saveLocalTranscript(source.id, remoteTranscript);
  }, [source?.id, remoteTranscript, localTranscript, offline]);

  const [triggering, setTriggering] = useState(false);
  const triggerGeneration = useCallback(async () => {
    if (!source?.episode_id) return;
    setTriggering(true);
    try {
      await generateTranscriptRagApiTranscriptGeneratePost({ episode_id: source.episode_id });
      Alert.alert("Processing", "Transcript generation started. Check back in a few minutes.");
    } catch {
      Alert.alert("Error", "Could not start transcript generation.");
    } finally {
      setTriggering(false);
    }
  }, [source?.episode_id]);

  return {
    transcript,
    transcriptLoading,
    transcriptProcessing,
    citationsByUtteranceIdx,
    triggering,
    triggerGeneration,
  };
}

export type { CitationWithCapture };
