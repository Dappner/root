"use client";

import { VideoPlayerProvider } from "@/features/sources/contexts/media-player-context";
import { useMediaPlaybackPosition } from "@/features/sources/hooks/use-media-playback-position";
import type { SourceDTO } from "@/features/sources/types";
import { useCallback, type ReactNode } from "react";

interface VideoPlayerScopeProps {
  source: SourceDTO;
  children: ReactNode;
}

export function VideoPlayerScope({ source, children }: VideoPlayerScopeProps) {
  const { savePosition } = useMediaPlaybackPosition({ source });
  const onPositionUpdate = useCallback(
    (position: number, duration: number) => savePosition(position, duration),
    [savePosition],
  );

  return (
    <VideoPlayerProvider onPositionUpdate={onPositionUpdate}>
      {children}
    </VideoPlayerProvider>
  );
}
