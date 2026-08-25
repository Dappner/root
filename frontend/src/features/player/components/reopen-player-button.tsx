"use client";

import { Headphones, Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePlayerStore } from "@/features/player/store";

export function ReopenPlayerButton() {
  const activeSource = usePlayerStore((s) => s.activeSource);
  const mode = usePlayerStore((s) => s.mode);
  const isPlaying = usePlayerStore((s) => s.isPlaying);

  if (!activeSource || mode !== "closed") return null;

  const label = activeSource.title
    ? `Reopen player: ${activeSource.title}`
    : "Reopen player";

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => usePlayerStore.getState().collapse()}
      aria-label={label}
      title={label}
      className="relative"
    >
      <Headphones className="size-4" />
      <span className="absolute -bottom-0.5 -right-0.5 inline-flex size-3 items-center justify-center rounded-full bg-primary text-primary-foreground">
        {isPlaying ? (
          <Pause className="size-2" />
        ) : (
          <Play className="size-2 ml-px" />
        )}
      </span>
    </Button>
  );
}
