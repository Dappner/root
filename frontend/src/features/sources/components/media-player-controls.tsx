"use client";

import { Button } from "@/components/ui/button";
import { useMediaPlayer } from "@/features/sources/contexts/media-player-context";
import type { SourceDTO } from "@/features/sources/types";
import { FloatingVideoPlayer } from "@/features/videos/components/floating-video-player";
import { Play } from "lucide-react";

function extractYoutubeId(source: SourceDTO): string | null {
  if (source.type !== "video" || !source.media_url) return null;
  return source.media_url.match(/embed\/([a-zA-Z0-9_-]{11})/)?.[1] ?? null;
}

export function MediaPlayerDock({ source }: { source: SourceDTO }) {
  const player = useMediaPlayer();
  const youtubeVideoId = extractYoutubeId(source);

  if (source.type !== "video" || !youtubeVideoId || player.type !== "video") {
    return null;
  }

  return (
    <>
      {!player.isVisible && (
        <Button
          onClick={() => player.setVisible(true)}
          variant="outline"
          className="gap-2"
        >
          <Play className="w-4 h-4" />
          Show Video Player
        </Button>
      )}

      {player.isVisible && (
        <FloatingVideoPlayer
          videoId={youtubeVideoId}
          startTime={0}
        />
      )}
    </>
  );
}
