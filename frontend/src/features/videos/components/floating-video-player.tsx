"use client";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMediaPlayer, type MediaPlayerVideo } from "@/features/sources/contexts/media-player-context";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { cn } from "@/lib/utils";
import { Expand, Shrink, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef } from "react";
import type { ComponentRef, SyntheticEvent } from "react";
import ReactPlayer from "react-player";
import { Gauge } from "lucide-react";

interface FloatingVideoPlayerProps {
  videoId: string;
  startTime?: number;
}

type Size = "small" | "medium" | "large";
type Corner = "top-left" | "top-right" | "bottom-left" | "bottom-right";

const SIZES: Record<Size, { width: number; height: number }> = {
  small: { width: 320, height: 180 },
  medium: { width: 480, height: 270 },
  large: { width: 640, height: 360 },
};

const HEADER_HEIGHT = 32;
const PADDING = 20;

const PLAYBACK_SPEEDS = [1, 1.25, 1.5, 1.75, 2] as const;
type PlaybackSpeed = typeof PLAYBACK_SPEEDS[number];

function FloatingVideoPlayerContent({
  videoId,
  startTime = 0,
  player,
}: FloatingVideoPlayerProps & { player: MediaPlayerVideo }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const focusProxyRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useLocalStorage<Size>("floating-video-player-size", "medium");
  const [corner, setCorner] = useLocalStorage<Corner>("floating-video-player-corner", "bottom-right");
  const [playbackSpeed, setPlaybackSpeed] = useLocalStorage<PlaybackSpeed>("floating-video-player-speed", 1);
  const playerRef = useRef<ComponentRef<typeof ReactPlayer> | null>(null);
  const didSeekRef = useRef(false);
  const lastUpdateTimeRef = useRef(0);

  const { registerPlayer, updateTime, updatePlayingState, setReady, setVisible } = player;

  const restoreAppFocus = useCallback(() => {
    const active = document.activeElement;
    if (!active || !containerRef.current?.contains(active)) return;
    if (!(active instanceof HTMLElement)) return;

    // Embedded player controls can retain focus and block app-level hotkeys.
    active.blur();
    focusProxyRef.current?.focus();
  }, []);

  // Compute position from corner + size
  const position = useMemo(() => {
    const currentSize = SIZES[size];
    const viewport = { width: window.innerWidth, height: window.innerHeight };

    switch (corner) {
      case "top-left":
        return { x: PADDING, y: PADDING };
      case "top-right":
        return { x: viewport.width - currentSize.width - PADDING, y: PADDING };
      case "bottom-left":
        return { x: PADDING, y: viewport.height - currentSize.height - PADDING };
      case "bottom-right":
        return {
          x: viewport.width - currentSize.width - PADDING,
          y: viewport.height - currentSize.height - PADDING,
        };
    }
  }, [corner, size]);

  const currentSize = SIZES[size];
  const sizes: Size[] = ["small", "medium", "large"];

  // Player callbacks (throttled to reduce re-renders)
  const UPDATE_THROTTLE_MS = 1000;

  const handleTimeUpdate = useCallback(
    (event: SyntheticEvent<HTMLVideoElement>) => {
      const el = event.currentTarget;
      if (!el.duration || Number.isNaN(el.duration)) return;

      // Throttle updates to max once per second
      const now = Date.now();
      if (now - lastUpdateTimeRef.current >= UPDATE_THROTTLE_MS) {
        updateTime(el.currentTime, el.duration);
        lastUpdateTimeRef.current = now;
      }
    },
    [updateTime]
  );

  const handleDurationChange = useCallback(
    (event: SyntheticEvent<HTMLVideoElement>) => {
      const el = event.currentTarget;
      if (el.duration && !Number.isNaN(el.duration)) {
        updateTime(el.currentTime, el.duration);
      }
    },
    [updateTime]
  );

  // Register player ref in context
  useEffect(() => {
    if (playerRef.current) {
      // Get internal player (video element or YouTube player)
      const internalPlayer = (playerRef.current as any).getInternalPlayer?.();
      if (internalPlayer) {
        registerPlayer(internalPlayer);
      } else {
        registerPlayer(playerRef.current);
      }
    }
  }, [registerPlayer]);

  useEffect(() => {
    const handleWindowBlur = () => {
      requestAnimationFrame(restoreAppFocus);
    };

    window.addEventListener("blur", handleWindowBlur);
    return () => window.removeEventListener("blur", handleWindowBlur);
  }, [restoreAppFocus]);

  const handleReady = useCallback(() => {
    setReady(true);
    if (playerRef.current) {
      // Get internal player (video element or YouTube player)
      const internalPlayer = (playerRef.current as any).getInternalPlayer?.();
      if (internalPlayer) {
        registerPlayer(internalPlayer);

        // Set initial seek time if needed
        if (!didSeekRef.current && startTime > 0) {
          if (internalPlayer.tagName === "VIDEO") {
            internalPlayer.currentTime = startTime;
            didSeekRef.current = true;
            updateTime(startTime, internalPlayer.duration || 0);
          } else {
            // For YouTube, seek is handled via ReactPlayer's start prop
            didSeekRef.current = true;
          }
        }
      } else {
        registerPlayer(playerRef.current);
      }
    }
  }, [registerPlayer, setReady, startTime, updateTime]);

  const getCornerLabel = (corner: Corner) => {
    switch (corner) {
      case "top-left": return "Top Left";
      case "top-right": return "Top Right";
      case "bottom-left": return "Bottom Left";
      case "bottom-right": return "Bottom Right";
    }
  };

  return (
    <div
      ref={containerRef}
      className="fixed z-50 bg-neutral-950 rounded-lg shadow-2xl border border-neutral-800 overflow-hidden transition-[width,height] duration-200"
      style={{
        left: position.x,
        top: position.y,
        width: currentSize.width,
        height: currentSize.height,
      }}
    >
      <div ref={focusProxyRef} tabIndex={-1} className="sr-only" aria-hidden />
      {/* Header */}
      <div
        className={cn(
          "flex items-center justify-between px-2 bg-neutral-900/80 backdrop-blur-sm h-8"
        )}
      >
        <div className="flex items-center gap-2 text-xs text-neutral-400">
          <Select value={corner} onValueChange={(value) => setCorner(value as Corner)}>
            <SelectTrigger size="sm" className="h-6 text-xs w-24">
              <SelectValue>{getCornerLabel(corner)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="top-left">Top Left</SelectItem>
              <SelectItem value="top-right">Top Right</SelectItem>
              <SelectItem value="bottom-left">Bottom Left</SelectItem>
              <SelectItem value="bottom-right">Bottom Right</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={playbackSpeed.toString()}
            onValueChange={(value) => {
              if (value) {
                setPlaybackSpeed(parseFloat(value) as PlaybackSpeed);
              }
            }}
          >
            <SelectTrigger size="sm" className="h-6 text-xs w-16">
              <div className="flex items-center gap-1">
                <Gauge className="w-3 h-3" />
                <SelectValue>{playbackSpeed}x</SelectValue>
              </div>
            </SelectTrigger>
            <SelectContent>
              {PLAYBACK_SPEEDS.map((speed) => (
                <SelectItem key={speed} value={speed.toString()}>
                  {speed}x
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 hover:bg-neutral-700"
            onClick={() => {
              const nextIndex = (sizes.indexOf(size) + 1) % sizes.length;
              setSize(sizes[nextIndex]);
            }}
            title={`Size: ${size}`}
          >
            {size === "large" ? (
              <Shrink className="w-3.5 h-3.5 text-neutral-300" />
            ) : (
              <Expand className="w-3.5 h-3.5 text-neutral-300" />
            )}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 hover:bg-red-900/50"
            onClick={() => setVisible(false)}
            title="Close"
          >
            <X className="w-3.5 h-3.5 text-neutral-300" />
          </Button>
        </div>
      </div>

      {/* Video */}
      <div style={{ height: currentSize.height - HEADER_HEIGHT }}>
        <ReactPlayer
          ref={playerRef}
          src={`https://www.youtube.com/watch?v=${videoId}`}
          controls
          playing={player.isPlaying}
          playbackRate={playbackSpeed}
          onReady={handleReady}
          onTimeUpdate={handleTimeUpdate}
          onDurationChange={handleDurationChange}
          onPlay={() => {
            updatePlayingState(true);
            restoreAppFocus();
          }}
          onPause={() => {
            updatePlayingState(false);
            restoreAppFocus();
          }}
          width="100%"
          height="100%"
          config={{
            youtube: {
              color: 'white',
              rel: 0,
              start: Math.floor(startTime),
            },
          }}
        />
      </div>
    </div>
  );
}

export function FloatingVideoPlayer(props: FloatingVideoPlayerProps) {
  const player = useMediaPlayer();
  if (player.type === "podcast") return null;

  return <FloatingVideoPlayerContent {...props} player={player} />;
}
