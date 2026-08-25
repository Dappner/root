"use client";

import { useEffect, useRef } from "react";
import { usePlayerStore } from "./store";
import { updateSourcePlaybackProgressRagApiPlaybackSourcesSourceIdProgressPut } from "@/features/rag/rag-api.generated";

const PROGRESS_SAVE_INTERVAL_MS = 10_000;
const PROGRESS_SAVE_JUMP_SECONDS = 30;

export function GlobalAudioElement() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const activeSource = usePlayerStore((s) => s.activeSource);
  const playPulse = usePlayerStore((s) => s.playPulse);
  const pausePulse = usePlayerStore((s) => s.pausePulse);
  const seekTarget = usePlayerStore((s) => s.seekTarget);
  const playbackRate = usePlayerStore((s) => s.playbackRate);
  const volume = usePlayerStore((s) => s.volume);

  const hasResumedRef = useRef(false);
  const lastSavedAtRef = useRef(0);
  const lastSavedPositionRef = useRef(0);
  const lastReportedTimeRef = useRef(0);

  // Reset resume gate on source/url change.
  useEffect(() => {
    hasResumedRef.current = false;
    lastSavedAtRef.current = 0;
    lastSavedPositionRef.current = 0;
    lastReportedTimeRef.current = 0;
  }, [activeSource?.id, activeSource?.mediaUrl]);

  // Wire audio element events to store reporters + handle resume/save.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !activeSource) return;

    const store = usePlayerStore.getState();
    const sourceId = activeSource.id;
    const resumeAt = activeSource.resumeAt ?? 0;

    audio.playbackRate = playbackRate;
    audio.volume = volume;

    const setReady = () => store.reportReady(audio.readyState >= 2);

    const maybeResume = () => {
      if (hasResumedRef.current) return;
      if (resumeAt > 0 && audio.readyState >= 1) {
        audio.currentTime = resumeAt;
      }
      hasResumedRef.current = true;
    };

    const saveProgress = (position: number, isPlaying: boolean) => {
      const duration = audio.duration > 0 ? audio.duration : undefined;
      updateSourcePlaybackProgressRagApiPlaybackSourcesSourceIdProgressPut(sourceId, {
        position_seconds: position,
        duration_seconds: duration,
        is_playing: isPlaying,
      });
      lastSavedAtRef.current = Date.now();
      lastSavedPositionRef.current = position;
    };

    const handleTimeUpdate = () => {
      const t = audio.currentTime;
      // Throttle store updates to ~4Hz to avoid render churn on transcript pages.
      if (Math.abs(t - lastReportedTimeRef.current) >= 0.25) {
        store.reportTime(t);
        lastReportedTimeRef.current = t;
      }
      const elapsedSinceSave = Date.now() - lastSavedAtRef.current;
      const positionJump = Math.abs(t - lastSavedPositionRef.current);
      if (elapsedSinceSave >= PROGRESS_SAVE_INTERVAL_MS || positionJump >= PROGRESS_SAVE_JUMP_SECONDS) {
        saveProgress(t, true);
      }
    };

    const handleDurationChange = () => {
      if (audio.duration > 0) store.reportDuration(audio.duration);
    };
    const handlePlay = () => store.reportPlaying(true);
    const handlePause = () => {
      store.reportPlaying(false);
      if (audio.currentTime > 0) saveProgress(audio.currentTime, false);
    };
    const handleEnded = () => {
      store.reportPlaying(false);
      saveProgress(audio.duration, false);
    };
    const handleCanPlay = () => {
      setReady();
      maybeResume();
    };
    const handleLoadedMetadata = () => {
      setReady();
      if (audio.duration > 0) store.reportDuration(audio.duration);
      maybeResume();
    };
    const handleError = () => {

      console.error("Audio error:", audio.error);
    };

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("durationchange", handleDurationChange);
    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("canplay", handleCanPlay);
    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("error", handleError);

    if (audio.readyState >= 1) handleLoadedMetadata();

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("durationchange", handleDurationChange);
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("canplay", handleCanPlay);
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("error", handleError);
      // Final save on teardown if we have meaningful position.
      const t = audio.currentTime;
      if (t > 0) {
        const duration = audio.duration > 0 ? audio.duration : undefined;
        updateSourcePlaybackProgressRagApiPlaybackSourcesSourceIdProgressPut(sourceId, {
          position_seconds: t,
          duration_seconds: duration,
          is_playing: false,
        });
      }
    };
  }, [activeSource, playbackRate, volume]);

  // Apply play pulses.
  useEffect(() => {
    if (playPulse === 0) return;
    const audio = audioRef.current;
    if (!audio) return;
    audio.play().catch((err: unknown) => {
      if (err && typeof err === "object" && "name" in err && (err as { name: string }).name === "AbortError") return;

      console.error("Playback failed:", err);
    });
  }, [playPulse]);

  // Apply pause pulses.
  useEffect(() => {
    if (pausePulse === 0) return;
    audioRef.current?.pause();
  }, [pausePulse]);

  // Apply seek targets.
  useEffect(() => {
    if (seekTarget == null) return;
    const audio = audioRef.current;
    if (audio) audio.currentTime = seekTarget;
    usePlayerStore.getState().consumeSeek();
  }, [seekTarget]);

  // Apply playback rate live.
  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = playbackRate;
  }, [playbackRate]);

  // Apply volume live.
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  if (!activeSource?.mediaUrl) return null;

  // Keyed by mediaUrl so a URL refresh remounts cleanly (e.g. signed-URL rotation).
  return (
    <audio
      key={activeSource.mediaUrl}
      ref={audioRef}
      src={activeSource.mediaUrl}
      preload="metadata"
      hidden
    />
  );
}
