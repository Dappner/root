"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { usePlayerStore } from "@/features/player/store";
import { useCreateVoiceSuggestion } from "@/features/suggestions/hooks";

export const MAX_RECORDING_SECONDS = 90;

function pickMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "";
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"];
  for (const type of candidates) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return "";
}

function extensionForMime(mime: string): string {
  if (mime.includes("mp4")) return "m4a";
  if (mime.includes("ogg")) return "ogg";
  return "webm";
}

export interface RecorderApi {
  /** Whether a recording is currently in progress. */
  isRecording: boolean;
  /** Seconds elapsed in the current recording. */
  elapsedSec: number;
  /** Hard cap for a recording, in seconds. */
  maxSec: number;
  /** Whether a finished recording is being uploaded. */
  isUploading: boolean;
  start: () => void;
  stop: () => void;
}

/**
 * Owns the live MediaRecorder, mic stream, countdown timer, and upload for a
 * voice note. Call this ONCE in an always-mounted parent (the player dock) and
 * share the returned api with every render variant — recording must survive the
 * collapse/expand swap, so the recorder cannot live inside a per-variant button.
 */
export function useRecorder(): RecorderApi {
  const activeSource = usePlayerStore((s) => s.activeSource);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const createVoice = useCreateVoiceSuggestion();

  const [isRecording, setIsRecording] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const positionAtStartRef = useRef(0);
  const wasPlayingRef = useRef(false);
  // When set, the next `onstop` should discard the recording instead of uploading.
  // Used on unmount-while-recording to avoid uploading an aborted note.
  const abortUploadRef = useRef(false);

  const clearTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const releaseStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  useEffect(() => () => {
    clearTimer();
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      abortUploadRef.current = true;
      try {
        recorder.stop();
      } catch {
        // Ignore — recorder may already be torn down.
      }
    }
    releaseStream();
    recorderRef.current = null;
  }, []);

  const stop = useCallback(() => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === "inactive") return;
    clearTimer();
    recorder.stop();
  }, []);

  const start = useCallback(async () => {
    if (!activeSource) return;
    if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      toast.error("Voice recording isn't supported in this browser.");
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      toast.error("Microphone access blocked. Enable it in your browser settings.");
      return;
    }
    streamRef.current = stream;

    const mimeType = pickMimeType();
    const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
    recorderRef.current = recorder;
    chunksRef.current = [];

    wasPlayingRef.current = isPlaying;
    positionAtStartRef.current = usePlayerStore.getState().currentTime;
    if (isPlaying) usePlayerStore.getState().pause();

    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = () => {
      const aborted = abortUploadRef.current;
      abortUploadRef.current = false;
      const recorded = chunksRef.current;
      chunksRef.current = [];
      recorderRef.current = null;

      if (aborted) {
        // Unmount cleanup already handled stream + state; just bail.
        return;
      }

      const blobType = recorder.mimeType || mimeType || "audio/webm";
      const blob = new Blob(recorded, { type: blobType });
      releaseStream();
      setIsRecording(false);
      setElapsedSec(0);

      const wasPlaying = wasPlayingRef.current;
      if (wasPlaying) usePlayerStore.getState().play();

      if (!activeSource || blob.size === 0) {
        toast.error("Recording failed. Please try again.");
        return;
      }

      const clientId =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `voice-${Date.now()}`;
      const ext = extensionForMime(blobType);

      createVoice.mutate(
        {
          file: blob,
          filename: `voice-${clientId}.${ext}`,
          clientId,
          sourceId: activeSource.id,
          episodeId: activeSource.episodeId ?? null,
          playbackPositionSeconds: positionAtStartRef.current,
          recordedAt: new Date().toISOString(),
        },
        {
          onSuccess: () => toast.success("Voice note sent. We'll process it shortly."),
          onError: (err) =>
            toast.error(err instanceof Error ? err.message : "Failed to send voice note."),
        },
      );
    };

    recorder.start();
    setIsRecording(true);
    setElapsedSec(0);

    let elapsed = 0;
    timerRef.current = setInterval(() => {
      elapsed += 1;
      setElapsedSec(elapsed);
      if (elapsed >= MAX_RECORDING_SECONDS) stop();
    }, 1000);
  }, [activeSource, isPlaying, createVoice, stop]);

  return {
    isRecording,
    elapsedSec,
    maxSec: MAX_RECORDING_SECONDS,
    isUploading: createVoice.isPending,
    start,
    stop,
  };
}
