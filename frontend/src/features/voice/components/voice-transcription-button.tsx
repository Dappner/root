"use client";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Loader2, Mic, Square } from "lucide-react";
import type { ComponentProps } from "react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { transcribeAudio } from "../api";

type VoiceTranscriptionState = "idle" | "recording" | "transcribing";
type ButtonVariant = ComponentProps<typeof Button>["variant"];
type ButtonSize = ComponentProps<typeof Button>["size"];

interface VoiceTranscriptionButtonProps {
  onTranscript: (transcript: string) => void;
  onRecordingStateChange?: (state: VoiceTranscriptionState, analyser: AnalyserNode | null) => void;
  disabled?: boolean;
  className?: string;
  tooltip?: string;
  label?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export function VoiceTranscriptionButton({
  onTranscript,
  onRecordingStateChange,
  disabled = false,
  className,
  tooltip = "Dictate",
  label: displayLabel,
  variant = "ghost",
  size = "icon",
}: VoiceTranscriptionButtonProps) {
  const [state, setState] = useState<VoiceTranscriptionState>("idle");
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const setStateAndNotify = (nextState: VoiceTranscriptionState) => {
    setState(nextState);
    onRecordingStateChange?.(nextState, nextState === "recording" ? analyserRef.current : null);
  };

  useEffect(() => {
    if (state !== "recording") {
      setElapsedSeconds(0);
      return;
    }

    const startedAt = Date.now();
    const interval = window.setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000));
    }, 250);

    return () => window.clearInterval(interval);
  }, [state]);

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    recorderRef.current = null;
    analyserRef.current?.disconnect();
    analyserRef.current = null;
    audioCtxRef.current?.close();
    audioCtxRef.current = null;
  };

  const transcribeRecording = async (audio: Blob) => {
    setStateAndNotify("transcribing");
    try {
      const result = await transcribeAudio(audio);
      if (!result.transcript.trim()) {
        toast.error("No speech detected");
        return;
      }
      onTranscript(result.transcript);
      toast.success("Transcript added");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to transcribe audio");
    } finally {
      setStateAndNotify("idle");
    }
  };

  const startRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      toast.error("Audio recording is not supported in this browser");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioCtx = new AudioContext();
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      audioCtx.createMediaStreamSource(stream).connect(analyser);
      audioCtxRef.current = audioCtx;
      analyserRef.current = analyser;

      const recorder = new MediaRecorder(stream);
      streamRef.current = stream;
      recorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };
      recorder.onstop = () => {
        const audio = new Blob(chunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        chunksRef.current = [];
        stopStream();
        void transcribeRecording(audio);
      };
      recorder.start();
      setElapsedSeconds(0);
      // Notify after analyser is set so the ref is populated
      setState("recording");
      onRecordingStateChange?.("recording", analyser);
    } catch {
      toast.error("Microphone access was blocked");
    }
  };

  const stopRecording = () => {
    if (recorderRef.current?.state === "recording") {
      recorderRef.current.stop();
      return;
    }
    stopStream();
    setStateAndNotify("idle");
  };

  const handleClick = () => {
    if (state === "recording") {
      stopRecording();
      return;
    }
    void startRecording();
  };

  const actionLabel = state === "recording" ? "Stop dictation" : tooltip;
  const hasTextLabel = Boolean(displayLabel);
  const expanded = state !== "idle" && hasTextLabel;
  const elapsedLabel = `${Math.floor(elapsedSeconds / 60)}:${String(elapsedSeconds % 60).padStart(2, "0")}`;

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type="button"
            variant={variant}
            size={expanded ? "sm" : size}
            disabled={disabled || state === "transcribing"}
            onClick={handleClick}
            aria-label={actionLabel}
            className={cn(
              "transition-all",
              expanded ? "h-8 w-auto rounded-full px-2.5" : "rounded-full",
              hasTextLabel && "min-w-0 gap-1.5",
              state === "recording" &&
                "border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/15",
              state === "transcribing" && "bg-muted text-muted-foreground",
              className
            )}
          />
        }
      >
        <VoiceButtonIcon state={state} />
        {state === "recording" && hasTextLabel && (
          <span className="flex items-center gap-1.5">
            <WaveformBars />
            <span className="tabular-nums">{elapsedLabel}</span>
          </span>
        )}
        {state === "transcribing" && hasTextLabel && <span>Transcribing</span>}
        {state === "idle" && displayLabel && <span>{displayLabel}</span>}
      </TooltipTrigger>
      <TooltipContent>{actionLabel}</TooltipContent>
    </Tooltip>
  );
}

function VoiceButtonIcon({ state }: { state: VoiceTranscriptionState }) {
  if (state === "recording") {
    return <Square className="size-3 fill-current sm:size-3.5" />;
  }

  if (state === "transcribing") {
    return <Loader2 className="size-3.5 animate-spin sm:size-4" />;
  }

  return <Mic className="size-3.5 sm:size-4" />;
}

function WaveformBars() {
  return (
    <span className="flex h-4 items-center gap-0.5" aria-hidden="true">
      {[0, 1, 2, 3, 4].map((index) => (
        <span
          key={index}
          className="w-0.5 rounded-full bg-current opacity-80 motion-safe:animate-pulse"
          style={{
            height: `${6 + ((index * 5) % 9)}px`,
            animationDelay: `${index * 90}ms`,
            animationDuration: "650ms",
          }}
        />
      ))}
    </span>
  );
}
