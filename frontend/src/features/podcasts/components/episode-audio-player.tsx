"use client";

import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { formatTime } from "@/lib/utils";
import { Pause, Play, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useEpisodeAudioUrl } from "../hooks";
import type { PodcastEpisodeDTO } from "../types";

interface EpisodeAudioPlayerProps {
  episode: PodcastEpisodeDTO;
  /** Optional saved playback position in seconds */
  savedPosition?: number;
  /** Callback when playback position updates (for saving) */
  onPositionUpdate?: (position: number) => void;
}

export function EpisodeAudioPlayer({
  episode,
  savedPosition = 0,
  onPositionUpdate
}: EpisodeAudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [hasResumed, setHasResumed] = useState(false);

  // Fetch a fresh archived audio URL when an R2 key is present.
  // Using React Query so the result is cached and retried automatically.
  const { data: audioUrlData } = useEpisodeAudioUrl(episode.id, !!episode.r2_audio_key);


  // Resume from saved position when audio is ready
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || hasResumed || savedPosition <= 0) return;

    const handleCanPlay = () => {
      audio.currentTime = savedPosition;
      setHasResumed(true);
    };

    audio.addEventListener("canplay", handleCanPlay);
    return () => audio.removeEventListener("canplay", handleCanPlay);
  }, [savedPosition, hasResumed]);

  // Track playback events
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      onPositionUpdate?.(audio.currentTime);
    };
    const handleDurationChange = () => setDuration(audio.duration);
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => {
      setIsPlaying(false);
      onPositionUpdate?.(audio.duration); // Mark as completed
    };

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("durationchange", handleDurationChange);
    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("durationchange", handleDurationChange);
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("ended", handleEnded);
    };
  }, [onPositionUpdate]);

  if (!episode.enclosure_url && !episode.r2_audio_key) {
    return null;
  }

  // Prefer the resolved archived URL (fresh, no expiry issues), then the
  // RSS enclosure_url as fallback when no archived audio exists.
  const audioSrc = audioUrlData?.url ?? episode.enclosure_url ?? undefined;

  const togglePlayPause = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
  };

  const handleSeek = (value: number | readonly number[]) => {
    const audio = audioRef.current;
    if (!audio) return;
    const v = Array.isArray(value) ? value[0] : value;
    audio.currentTime = v;
  };

  const handleRestart = () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = 0;
    audio.play();
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border bg-card">
      <audio
        ref={audioRef}
        src={audioSrc}
        preload="metadata"
      />

      {/* Play/Pause Button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={togglePlayPause}
        className="shrink-0"
      >
        {isPlaying ? (
          <Pause className="w-5 h-5" />
        ) : (
          <Play className="w-5 h-5" />
        )}
      </Button>

      {/* Restart Button (if in progress) */}
      {currentTime > 0 && (
        <Button
          variant="ghost"
          size="icon"
          onClick={handleRestart}
          className="shrink-0"
        >
          <RotateCcw className="w-4 h-4" />
        </Button>
      )}

      {/* Time Display */}
      <div className="text-xs text-muted-foreground whitespace-nowrap min-w-20">
        {formatTime(currentTime)} / {formatTime(duration)}
      </div>

      <div className="flex-1">
        <Slider
          value={[currentTime]}
          max={duration || 100}
          step={1}
          onValueChange={handleSeek}
          className="w-full"
        />
      </div>

      {/* Progress Percentage */}
      {savedPosition > 0 && !hasResumed && (
        <div className="text-xs text-muted-foreground whitespace-nowrap">
          Resume from {formatTime(savedPosition)}
        </div>
      )}
      {progress > 0 && (
        <div className="text-xs text-muted-foreground whitespace-nowrap min-w-10 text-right">
          {Math.floor(progress)}%
        </div>
      )}
    </div>
  );
}
