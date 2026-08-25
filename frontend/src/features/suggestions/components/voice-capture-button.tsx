"use client";

import { Loader2, Mic, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { RecorderApi } from "@/features/suggestions/use-recorder";
import { cn } from "@/lib/utils";

interface VoiceCaptureButtonProps {
  recorder: RecorderApi;
  size?: "sm" | "icon";
}

/**
 * Dumb record/stop control. All recording state is owned by `useRecorder` and
 * passed in, so the chip and expanded dock variants render the SAME live state
 * — recording started in one survives the swap to the other.
 */
export function VoiceCaptureButton({ recorder, size = "icon" }: VoiceCaptureButtonProps) {
  const { isRecording, elapsedSec, maxSec, isUploading, start, stop } = recorder;

  const disabled = isUploading;

  const label = isRecording
    ? `Stop recording (${elapsedSec}s / ${maxSec}s)`
    : isUploading
    ? "Sending voice note"
    : "Record voice note";

  return (
    <div className="flex items-center gap-1.5 shrink-0">
      <Button
        variant="ghost"
        size={size}
        onClick={isRecording ? stop : start}
        disabled={disabled}
        aria-label={label}
        title={label}
        className={cn(isRecording && "text-red-500 hover:text-red-600")}
      >
        {isUploading ? (
          <Loader2 className="size-4 animate-spin" />
        ) : isRecording ? (
          <Square className="size-4 fill-current" />
        ) : (
          <Mic className="size-4" />
        )}
        {size === "sm" && isRecording && (
          <span className="ml-1 text-xs font-mono tabular-nums">{elapsedSec}s</span>
        )}
      </Button>
      {isRecording && size === "icon" && (
        <span className="text-xs font-mono tabular-nums text-red-500 whitespace-nowrap">
          {elapsedSec}s / {maxSec}s
        </span>
      )}
    </div>
  );
}
