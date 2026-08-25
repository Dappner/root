"use client";

import { Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePlayerControl } from "@/features/player/hooks/use-load-source";
import type { SourceDTO } from "@/features/sources/types";

interface SourcePlayButtonProps {
  source: SourceDTO;
}

export function SourcePlayButton({ source }: SourcePlayButtonProps) {
  const { isActive, isPlaying, playOrToggle } = usePlayerControl(source);

  if (source.type !== "podcast" || !source.media_url) return null;

  const label = isPlaying ? "Pause" : isActive ? "Resume" : "Play";

  return (
    <Button
      variant="default"
      size="sm"
      onClick={playOrToggle}
      aria-label={label}
    >
      {isPlaying ? <Pause className="h-4 w-4 mr-1" /> : <Play className="h-4 w-4 mr-1" />}
      {label}
    </Button>
  );
}
