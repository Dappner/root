"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import { useLocalStorage } from "@/hooks/use-local-storage";
import type { TranscriptUtterance } from "@/features/podcasts/types";
import { usePlayerStore } from "@/features/player/store";

// ============================================================================
// Shared types
// ============================================================================

interface MediaPlayerBase {
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  isReady: boolean;
  play: () => void;
  pause: () => void;
  togglePlayPause: () => void;
  seek: (time: number) => void;
}

export interface MediaPlayerPodcast extends MediaPlayerBase {
  type: "podcast";
  playbackRate: number;
  volume: number;
  currentUtterance: TranscriptUtterance | null;
  currentUtteranceIndex: number;
  skipForward: (seconds: number) => void;
  skipBackward: (seconds: number) => void;
  setPlaybackRate: (rate: number) => void;
  setVolume: (volume: number) => void;
  setUtterances: (utterances: TranscriptUtterance[]) => void;
}

export interface MediaPlayerVideo extends MediaPlayerBase {
  type: "video";
  isVisible: boolean;
  registerPlayer: (player: unknown) => void;
  updateTime: (time: number, duration: number) => void;
  updatePlayingState: (playing: boolean) => void;
  setReady: (ready: boolean) => void;
  setVisible: (visible: boolean) => void;
}

export type MediaPlayer = MediaPlayerPodcast | MediaPlayerVideo;

// ============================================================================
// Video-only context (podcast playback lives in the global player store)
// ============================================================================

const VideoPlayerContext = createContext<MediaPlayerVideo | null>(null);

function usePodcastFromStore(): MediaPlayerPodcast | null {
  const activeSource = usePlayerStore((s) => s.activeSource);
  const currentTime = usePlayerStore((s) => s.currentTime);
  const duration = usePlayerStore((s) => s.duration);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const isReady = usePlayerStore((s) => s.isReady);
  const playbackRate = usePlayerStore((s) => s.playbackRate);
  const volume = usePlayerStore((s) => s.volume);
  const utterances = usePlayerStore((s) => s.utterances);

  const play = useCallback(() => usePlayerStore.getState().play(), []);
  const pause = useCallback(() => usePlayerStore.getState().pause(), []);
  const togglePlayPause = useCallback(() => usePlayerStore.getState().toggle(), []);
  const seek = useCallback((time: number) => usePlayerStore.getState().seek(time), []);
  const skipForward = useCallback((seconds: number) => usePlayerStore.getState().skip(seconds), []);
  const skipBackward = useCallback((seconds: number) => usePlayerStore.getState().skip(-seconds), []);
  const setPlaybackRate = useCallback((rate: number) => usePlayerStore.getState().setPlaybackRate(rate), []);
  const setVolume = useCallback((v: number) => usePlayerStore.getState().setVolume(v), []);
  const setUtterances = useCallback(
    (next: TranscriptUtterance[]) => usePlayerStore.getState().setUtterances(next),
    [],
  );

  const { currentUtterance, currentUtteranceIndex } = useMemo(() => {
    const idx = utterances.findIndex((u) => u.start <= currentTime && currentTime <= u.end);
    return {
      currentUtteranceIndex: idx,
      currentUtterance: idx >= 0 ? utterances[idx] : null,
    };
  }, [utterances, currentTime]);

  if (!activeSource) return null;

  return {
    type: "podcast",
    currentTime,
    duration,
    isPlaying,
    isReady,
    playbackRate,
    volume,
    currentUtterance,
    currentUtteranceIndex,
    play,
    pause,
    togglePlayPause,
    seek,
    skipForward,
    skipBackward,
    setPlaybackRate,
    setVolume,
    setUtterances,
  };
}

export function useMediaPlayer(): MediaPlayer {
  const podcast = usePodcastFromStore();
  const video = useContext(VideoPlayerContext);
  if (podcast) return podcast;
  if (video) return video;
  throw new Error("useMediaPlayer must be used within a player provider or with an active source loaded");
}

export function useMediaPlayerSafe(): MediaPlayer | null {
  const podcast = usePodcastFromStore();
  const video = useContext(VideoPlayerContext);
  return podcast ?? video;
}

// ============================================================================
// VideoPlayerProvider — unchanged, page-scoped for embedded YouTube player
// ============================================================================

interface VideoPlayerProviderProps {
  children: React.ReactNode;
  savedPosition?: number;
  onPositionUpdate?: (position: number, duration: number) => void;
}

export function VideoPlayerProvider({
  children,
  onPositionUpdate,
}: VideoPlayerProviderProps) {
  const playerRef = useRef<{ play?: () => Promise<void>; pause?: () => void; getInternalPlayer?: () => unknown } | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isReady, setIsReadyState] = useState(false);
  const [isVisible, setIsVisibleState] = useLocalStorage("floating-video-player-visible", true);

  const play = useCallback(() => {
    playerRef.current?.play?.().catch(() => {});
    setIsPlaying(true);
  }, []);
  const pause = useCallback(() => {
    playerRef.current?.pause?.();
    setIsPlaying(false);
  }, []);
  const togglePlayPause = useCallback(() => {
    if (isPlaying) pause();
    else play();
  }, [isPlaying, play, pause]);
  const seek = useCallback((time: number) => {
    const internal = playerRef.current?.getInternalPlayer
      ? (playerRef.current.getInternalPlayer() as { currentTime?: number } | null)
      : (playerRef.current as { currentTime?: number } | null);
    if (internal && typeof internal.currentTime === "number") {
      // eslint-disable-next-line react-hooks/immutability
      internal.currentTime = time;
    }
    setCurrentTime(time);
  }, []);
  const registerPlayer = useCallback((player: unknown) => {
    playerRef.current = player as typeof playerRef.current;
  }, []);
  const updateTime = useCallback(
    (time: number, dur: number) => {
      setCurrentTime(time);
      if (dur > 0) {
        setDuration(dur);
        onPositionUpdate?.(time, dur);
      }
    },
    [onPositionUpdate],
  );
  const updatePlayingState = useCallback((playing: boolean) => setIsPlaying(playing), []);
  const setReady = useCallback((ready: boolean) => setIsReadyState(ready), []);
  const setVisible = useCallback((visible: boolean) => setIsVisibleState(visible), [setIsVisibleState]);

  const value: MediaPlayerVideo = {
    type: "video",
    isPlaying,
    currentTime,
    duration,
    isReady,
    isVisible,
    play,
    pause,
    togglePlayPause,
    seek,
    registerPlayer,
    updateTime,
    updatePlayingState,
    setReady,
    setVisible,
  };

  return <VideoPlayerContext.Provider value={value}>{children}</VideoPlayerContext.Provider>;
}
