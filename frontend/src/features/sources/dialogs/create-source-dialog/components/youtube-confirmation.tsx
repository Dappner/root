"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { VideoPreview } from "@/features/videos/components/video-preview";
import type { VideoDTO } from "@/features/videos/types";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";

interface YouTubeConfirmationProps {
  isImporting: boolean;
  importError: unknown;
  video: VideoDTO | null;
  onAddToLibrary: () => void;
  isAdding: boolean;
}

/**
 * Collapsed YouTube state for the Add Source dialog: a recognized YouTube URL
 * auto-imports, then this card confirms the detected video and offers a single
 * "Add to Library" action. Transcription/sectioning/embedding kick off on the
 * backend once added — no manual title/channel entry needed here.
 */
export function YouTubeConfirmation({
  isImporting,
  importError,
  video,
  onAddToLibrary,
  isAdding,
}: YouTubeConfirmationProps) {
  if (importError) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          {importError instanceof Error
            ? importError.message
            : "Failed to import video. Check the URL and try again."}
        </AlertDescription>
      </Alert>
    );
  }

  if (isImporting || !video) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Detecting YouTube video…</span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-400">
        <CheckCircle2 className="h-4 w-4" />
        <span>YouTube video detected</span>
      </div>

      <VideoPreview video={video} />

      <div className="flex justify-end">
        <Button type="button" onClick={onAddToLibrary} disabled={isAdding}>
          {isAdding && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Add to Library
        </Button>
      </div>
    </div>
  );
}
