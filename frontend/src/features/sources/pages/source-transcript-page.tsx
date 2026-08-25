"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { TranscriptUtterance } from "@/features/podcasts/types";
import {
  useGenerateTranscript,
  useTranscriptContent,
  useTranscriptStatus,
} from "@/features/podcasts/transcript-hooks";
import { useMediaPlayer } from "@/features/sources/contexts/media-player-context";
import { usePlayerStore } from "@/features/player/store";
import { usePlayerControl } from "@/features/player/hooks/use-load-source";
import { useRegisterSectionsSidebar } from "@/features/sources/components/source-sections-sidebar/store";
import { useCitationsWithCaptures } from "@/features/sources/hooks/citations";
import { useSource } from "@/features/sources/hooks/sources";
import { ContinuousTranscriptDisplay } from "@/features/sources/pages/source-transcript-page-components/continuous-transcript-display";
import type { SourceDTO } from "@/features/sources/types";
import { useVideoTranscript } from "@/features/videos/hooks";
import { AlertCircle, FileText, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { useCallback, useEffect, useRef } from "react";

interface SourceTranscriptPageProps {
  sourceId: number;
}

interface TranscriptStateCardProps {
  title: string;
  description: string;
  icon?: "file" | "sparkles" | "alert" | "loading";
  actionLabel?: string;
  onAction?: () => void;
  actionPending?: boolean;
  actionVariant?: "default" | "outline";
}

function TranscriptStateCard({
  title,
  description,
  icon = "file",
  actionLabel,
  onAction,
  actionPending = false,
  actionVariant = "default",
}: TranscriptStateCardProps) {
  const Icon =
    icon === "alert"
      ? AlertCircle
      : icon === "loading"
        ? Loader2
        : icon === "sparkles"
          ? Sparkles
          : FileText;

  return (
    <div className="max-w-lg mx-auto mt-8 rounded-xl border bg-card">
      <div className="px-6 pt-6 pb-4 text-center">
        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
          <Icon className={icon === "loading" ? "w-6 h-6 animate-spin text-muted-foreground" : "w-6 h-6 text-muted-foreground"} />
        </div>
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>
      </div>
      {actionLabel && onAction && (
        <div className="px-6 pb-6 text-center">
          <Button onClick={onAction} disabled={actionPending} variant={actionVariant}>
            {actionPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Working...
              </>
            ) : (
              <>
                {icon === "alert" ? (
                  <RefreshCw className="w-4 h-4 mr-2" />
                ) : (
                  <Sparkles className="w-4 h-4 mr-2" />
                )}
                {actionLabel}
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}

function TranscriptLoadingState() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="h-6 w-32 rounded bg-muted animate-pulse" />
        <div className="h-4 w-64 rounded bg-muted animate-pulse" />
      </div>
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-20 w-full rounded bg-muted animate-pulse" />
        ))}
      </div>
    </div>
  );
}

/**
 * Pushes podcast utterances into the global player store so the persistent
 * audio element can resolve the current utterance for follow-playback. Only
 * runs when this source is the active one — pushing utterances for an
 * inactive source would overwrite whatever is playing globally.
 */
function PodcastTranscriptSync({
  source,
  utterances,
}: {
  source: SourceDTO;
  utterances: TranscriptUtterance[];
}) {
  const activeId = usePlayerStore((s) => s.activeSource?.id);
  const lastSetRef = useRef<TranscriptUtterance[] | null>(null);

  useEffect(() => {
    if (activeId !== source.id) return;
    if (utterances === lastSetRef.current) return;
    usePlayerStore.getState().setUtterances(utterances);
    lastSetRef.current = utterances;
  }, [activeId, source.id, utterances]);

  return null;
}

function PodcastTranscriptDisplay({
  source,
  utterances,
}: {
  source: SourceDTO;
  utterances: TranscriptUtterance[];
}) {
  const { loadAndSeek } = usePlayerControl(source);
  const handleSeek = useCallback((time: number) => loadAndSeek(time), [loadAndSeek]);

  return (
    <ContinuousTranscriptDisplay
      utterances={utterances}
      sourceId={source.id}
      onSeek={handleSeek}
      playerType="podcast"
      playerIsVisible
    />
  );
}

function VideoTranscriptDisplay({
  utterances,
  sourceId,
}: {
  utterances: TranscriptUtterance[];
  sourceId: number;
}) {
  const player = useMediaPlayer();

  return (
    <ContinuousTranscriptDisplay
      utterances={utterances}
      sourceId={sourceId}
      onSeek={player.seek}
      playerType={player.type}
      playerIsVisible={player.type === "video" ? player.isVisible : true}
    />
  );
}

export function SourceTranscriptPage({ sourceId }: SourceTranscriptPageProps) {
  useRegisterSectionsSidebar(sourceId);
  const { data: source } = useSource(sourceId);
  const episodeId = source?.episode_id ?? undefined;
  const videoId = source?.type === "video" ? source.video_id ?? undefined : undefined;
  const isVideo = source?.type === "video";

  const podcastStatus = useTranscriptStatus(episodeId ?? 0, !!episodeId);
  const podcastContent = useTranscriptContent(
    episodeId ?? 0,
    !!episodeId && (podcastStatus.data?.status === "transcribed" || podcastStatus.data?.status === "embedded"),
  );
  const generatePodcastTranscript = useGenerateTranscript();

  const videoTranscript = useVideoTranscript(videoId);

  // Warm citations/captures caches in parallel with the transcript content
  // fetch — without this, ContinuousTranscriptDisplay only mounts after
  // content resolves, so these requests get serialized behind it.
  useCitationsWithCaptures(sourceId);

  const handleGeneratePodcastTranscript = () => {
    if (!episodeId) return;
    generatePodcastTranscript.mutate({ episode_id: episodeId });
  };

  if (isVideo) {
    if (videoTranscript.statusIsLoading) {
      return <TranscriptLoadingState />;
    }

    if (videoTranscript.status === "none") {
      return (
        <TranscriptStateCard
          title="Generate Transcript"
          description="Generate a transcript from this video. We’ll first try YouTube captions, then fall back to AI transcription if needed."
          icon="file"
          actionLabel="Generate Transcript"
          onAction={videoTranscript.generate}
          actionPending={videoTranscript.isGenerating}
        />
      );
    }

    if (videoTranscript.isPending) {
      return (
        <TranscriptStateCard
          title="Generating Transcript"
          description="This usually takes a few minutes. You can leave this page and come back later."
          icon="loading"
        />
      );
    }

    if (videoTranscript.isFailed) {
      return (
        <TranscriptStateCard
          title="Transcript Generation Failed"
          description="Something went wrong while generating the transcript."
          icon="alert"
          actionLabel="Try Again"
          onAction={videoTranscript.generate}
          actionPending={videoTranscript.isGenerating}
          actionVariant="outline"
        />
      );
    }

    if (videoTranscript.contentIsLoading) {
      return <TranscriptLoadingState />;
    }

    if (videoTranscript.isCompleted && videoTranscript.content) {
      const normalizedUtterances = videoTranscript.content.utterances.map((u) => ({
        ...u,
        confidence: u.confidence ?? 0,
        speaker: u.speaker ?? "",
      }));

      return (
        <VideoTranscriptDisplay
          utterances={normalizedUtterances}
          sourceId={sourceId}
        />
      );
    }

    return null;
  }

  if (!episodeId) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          This source is not linked to a podcast episode. Transcripts are only available for podcast episodes.
        </AlertDescription>
      </Alert>
    );
  }

  if (podcastStatus.isLoading) {
    return <TranscriptLoadingState />;
  }

  const podcastTranscriptStatus = podcastStatus.data?.status || "none";

  if (podcastTranscriptStatus === "none") {
    return (
      <TranscriptStateCard
        title="Generate Transcript"
        description="This podcast episode doesn’t have a transcript yet. Generate one using AI. This usually takes a few minutes."
        icon="sparkles"
        actionLabel="Generate Transcript"
        onAction={handleGeneratePodcastTranscript}
        actionPending={generatePodcastTranscript.isPending}
      />
    );
  }

  if (podcastTranscriptStatus === "pending") {
    return (
      <TranscriptStateCard
        title="Generating Transcript"
        description="This usually takes a few minutes. Feel free to navigate away and come back later."
        icon="loading"
      />
    );
  }

  if (podcastTranscriptStatus === "failed") {
    return (
      <TranscriptStateCard
        title="Transcript Generation Failed"
        description="This could be due to a temporary issue or an error processing the episode audio."
        icon="alert"
        actionLabel="Retry Generation"
        onAction={handleGeneratePodcastTranscript}
        actionPending={generatePodcastTranscript.isPending}
        actionVariant="outline"
      />
    );
  }

  if (podcastContent.isLoading) {
    return <TranscriptLoadingState />;
  }

  if ((podcastTranscriptStatus === "transcribed" || podcastTranscriptStatus === "embedded") && podcastContent.data && source) {
    return (
      <>
        <PodcastTranscriptSync source={source} utterances={podcastContent.data.utterances} />
        <PodcastTranscriptDisplay source={source} utterances={podcastContent.data.utterances} />
      </>
    );
  }

  return null;
}
