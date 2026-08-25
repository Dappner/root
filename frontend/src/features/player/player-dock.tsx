"use client";

import { usePathname, Link } from "@/lib/nav";
import { useState } from "react";
import { ChevronLeft, ChevronRight, FileText, Gauge, Pause, Play, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useSidebar } from "@/components/ui/sidebar";
import { usePlayerStore } from "@/features/player/store";
import { VoiceCaptureButton } from "@/features/suggestions/components/voice-capture-button";
import { useRecorder, type RecorderApi } from "@/features/suggestions/use-recorder";
import { formatTime } from "@/lib/utils";

const SPEED_OPTIONS = [1, 1.25, 1.5, 2];

function SkipBack15Icon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
      <path d="M2.75 2.5a.75.75 0 0 0-.75.75v5.5c0 .414.336.75.75.75h5.5a.75.75 0 0 0 0-1.5H4.343C5.4 6.602 6.77 5.465 8.472 4.938a9.7 9.7 0 0 1 6.266.165c2.03.755 3.91 2.285 4.854 4.008a.75.75 0 0 0 1.316-.721c-1.143-2.083-3.33-3.831-5.647-4.693a11.2 11.2 0 0 0-7.233-.192C6.15 4.087 4.653 5.262 3.5 6.65v-3.4a.75.75 0 0 0-.75-.75m6.203 8.528a.75.75 0 0 1 .547.722v8.5a.75.75 0 0 1-1.5 0v-6.417c-.382.369-.84.746-1.364 1.06a.75.75 0 1 1-.772-1.286c.676-.405 1.24-.965 1.643-1.44a8 8 0 0 0 .597-.798l.006-.009v-.001a.75.75 0 0 1 .843-.331m4.246 1.601c.554-.991 1.483-1.629 2.803-1.629s2.25.638 2.803 1.629c.522.933.697 2.147.697 3.371s-.175 2.438-.697 3.371c-.554.991-1.483 1.629-2.803 1.629s-2.25-.638-2.803-1.629c-.522-.933-.697-2.147-.697-3.371s.175-2.438.697-3.371m1.31.732c-.339.604-.507 1.516-.507 2.639s.168 2.035.506 2.64c.306.546.751.86 1.494.86s1.188-.314 1.494-.86c.338-.605.506-1.517.506-2.64s-.168-2.035-.506-2.64c-.306-.546-.751-.86-1.494-.86s-1.188.314-1.494.86" />
    </svg>
  );
}

function SkipForward30Icon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
      <path d="M21.25 2.5a.75.75 0 0 1 .75.75v5.5a.75.75 0 0 1-.75.75h-5.5a.75.75 0 0 1 0-1.5h3.907C18.6 6.602 17.23 5.465 15.528 4.938a9.7 9.7 0 0 0-6.266.165c-2.03.755-3.91 2.285-4.854 4.008a.75.75 0 1 1-1.315-.721c1.142-2.083 3.33-3.831 5.646-4.693a11.2 11.2 0 0 1 7.233-.192c1.878.582 3.374 1.757 4.528 3.144V3.25a.75.75 0 0 1 .75-.75M16.002 11c-1.32 0-2.25.638-2.803 1.629c-.522.933-.697 2.147-.697 3.371s.175 2.438.697 3.371c.553.991 1.483 1.629 2.803 1.629s2.25-.638 2.803-1.629c.521-.933.697-2.147.697-3.371s-.175-2.438-.697-3.371C18.251 11.638 17.322 11 16.002 11m-2 5c0-1.123.168-2.035.506-2.64c.306-.546.751-.86 1.494-.86s1.188.314 1.494.86c.337.605.506 1.517.506 2.64s-.169 2.035-.506 2.64c-.306.546-.751.86-1.494.86s-1.188-.314-1.494-.86c-.338-.605-.506-1.517-.506-2.64M9.5 11.75a.75.75 0 0 0-1.39-.391v.001l-.006.009a3 3 0 0 1-.141.21a8 8 0 0 1-.457.589c-.402.474-.966 1.034-1.642 1.439a.75.75 0 1 0 .772 1.286A7.7 7.7 0 0 0 8 13.833v6.417a.75.75 0 0 0 1.5 0z" />
    </svg>
  );
}

function useDockOffset() {
  const { state, isMobile } = useSidebar();
  if (isMobile) return undefined;
  return state === "expanded" ? "var(--sidebar-width)" : "var(--sidebar-width-icon)";
}

function ChipVariant({ recorder }: { recorder: RecorderApi }) {
  const activeSource = usePlayerStore((s) => s.activeSource);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const currentTime = usePlayerStore((s) => s.currentTime);
  const duration = usePlayerStore((s) => s.duration);
  const left = useDockOffset();

  if (!activeSource) return null;

  return (
    <div
      className="fixed bottom-4 z-40 pointer-events-none"
      style={left ? { left: `calc(${left} + 1rem)` } : { left: "1rem" }}
    >
      <div
        className="pointer-events-auto flex h-16 items-center gap-3 rounded-xl border bg-background/95 backdrop-blur p-2 shadow-lg max-w-xs"
      >
        <div className="relative size-12 shrink-0 rounded-md overflow-hidden bg-secondary">
          {activeSource.imageUrl ? (
            <img src={activeSource.imageUrl} alt="" className="w-full h-full object-cover" />
          ) : null}
          <PlayPauseOverlay isPlaying={isPlaying} />
        </div>
        <div className="flex-1 min-w-0 text-left">
          <Link
            href={`/library/${activeSource.id}`}
            className="block text-xs font-medium truncate hover:underline"
          >
            {activeSource.title}
          </Link>
          <div className="text-[11px] text-muted-foreground font-mono">
            {formatTime(currentTime)}
            {duration > 0 ? ` / ${formatTime(duration)}` : ""}
          </div>
        </div>
        <VoiceCaptureButton recorder={recorder} />
        <button
          type="button"
          onClick={() => usePlayerStore.getState().close()}
          className="shrink-0 inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
          aria-label="Close player"
        >
          <X className="size-4" />
        </button>
        <button
          type="button"
          onClick={() => usePlayerStore.getState().expand()}
          className="shrink-0 inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
          aria-label="Expand player"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>
    </div>
  );
}

function PlayPauseOverlay({ isPlaying }: { isPlaying: boolean }) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={(e) => {
        e.stopPropagation();
        usePlayerStore.getState().toggle();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          e.stopPropagation();
          usePlayerStore.getState().toggle();
        }
      }}
      className="absolute inset-0 flex items-center justify-center bg-black/40 text-white hover:bg-black/55 transition-colors cursor-pointer"
      aria-label={isPlaying ? "Pause" : "Play"}
    >
      {isPlaying ? <Pause className="size-4" /> : <Play className="size-4 ml-0.5" />}
    </div>
  );
}

function ExpandedVariant({ integrated, recorder }: { integrated: boolean; recorder: RecorderApi }) {
  const activeSource = usePlayerStore((s) => s.activeSource);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const currentTime = usePlayerStore((s) => s.currentTime);
  const duration = usePlayerStore((s) => s.duration);
  const playbackRate = usePlayerStore((s) => s.playbackRate);
  const left = useDockOffset();

  const [isSeeking, setIsSeeking] = useState(false);
  const [seekValue, setSeekValue] = useState(0);

  if (!activeSource) return null;

  const displayTime = isSeeking ? seekValue : currentTime;
  const remaining = Math.max(0, (duration || 0) - displayTime);

  const handleSeekChange = (value: number | readonly number[]) => {
    setIsSeeking(true);
    setSeekValue(Array.isArray(value) ? value[0] : (value as number));
  };
  const handleSeekCommit = (value: number | readonly number[]) => {
    setIsSeeking(false);
    const v = Array.isArray(value) ? value[0] : (value as number);
    usePlayerStore.getState().seek(v);
  };

  const cycleSpeed = () => {
    const idx = SPEED_OPTIONS.indexOf(playbackRate);
    const next = SPEED_OPTIONS[(idx + 1) % SPEED_OPTIONS.length];
    usePlayerStore.getState().setPlaybackRate(next);
  };

  const transcriptHref = `/library/${activeSource.id}/transcript`;

  return (
    <div
      className="fixed bottom-4 z-40 pointer-events-none right-0"
      style={left ? { left } : undefined}
    >
      <div className="container mx-auto px-4">
        <div className="pointer-events-auto">
          <div className="flex h-16 items-center gap-3 rounded-xl border bg-background/95 backdrop-blur p-2 shadow-lg">
            {!integrated && activeSource.imageUrl && (
              <img
                src={activeSource.imageUrl}
                alt=""
                className="size-12 rounded-md object-cover shrink-0"
              />
            )}

            {!integrated && (
              <div className="hidden md:block min-w-0 max-w-[18ch]">
                <Link
                  href={`/library/${activeSource.id}`}
                  className="block text-sm font-medium truncate hover:underline"
                >
                  {activeSource.title}
                </Link>
                {activeSource.subtitle && (
                  <div className="text-xs text-muted-foreground truncate">
                    {activeSource.subtitle}
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center gap-1 shrink-0">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => usePlayerStore.getState().skip(-15)}
                disabled={!duration}
                aria-label="Skip back 15 seconds"
              >
                <SkipBack15Icon />
              </Button>
              <Button
                variant="default"
                size="icon"
                onClick={() => usePlayerStore.getState().toggle()}
                disabled={!duration}
                className="h-10 w-10"
                aria-label={isPlaying ? "Pause" : "Play"}
              >
                {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => usePlayerStore.getState().skip(30)}
                disabled={!duration}
                aria-label="Skip forward 30 seconds"
              >
                <SkipForward30Icon />
              </Button>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={cycleSpeed}
              className="gap-1 shrink-0"
              aria-label="Playback speed"
            >
              <Gauge className="h-4 w-4" />
              <span className="text-xs font-medium">{playbackRate}x</span>
            </Button>

            <div className="flex-1 flex items-center gap-3 min-w-0">
              <span className="text-xs font-mono text-muted-foreground whitespace-nowrap tabular-nums">
                {formatTime(displayTime)}
              </span>
              <Slider
                value={[displayTime]}
                max={duration || 100}
                step={0.1}
                onValueChange={handleSeekChange}
                onValueCommitted={handleSeekCommit}
                disabled={!duration}
                className="flex-1"
              />
              <span className="text-xs font-mono text-muted-foreground whitespace-nowrap tabular-nums">
                -{formatTime(remaining)}
              </span>
            </div>

            {!integrated && (
              <Button
                variant="ghost"
                size="icon"
                nativeButton={false}
                render={<Link href={transcriptHref} aria-label="Open transcript" />}
              >
                <FileText className="h-4 w-4" />
              </Button>
            )}

            <VoiceCaptureButton recorder={recorder} />

            <Button
              variant="ghost"
              size="icon"
              onClick={() => usePlayerStore.getState().close()}
              aria-label="Close player"
            >
              <X className="h-4 w-4" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => usePlayerStore.getState().collapse()}
              aria-label="Collapse player"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function PlayerDock() {
  const activeSource = usePlayerStore((s) => s.activeSource);
  const mode = usePlayerStore((s) => s.mode);
  const pathname = usePathname();
  // One recorder for the whole dock. PlayerDock stays mounted across the
  // collapse/expand swap, so a recording started in one variant survives into
  // the other — the per-variant buttons just render this shared state.
  const recorder = useRecorder();

  if (!activeSource || mode === "closed") return null;

  const integrated = !!pathname && pathname.startsWith(`/library/${activeSource.id}/transcript`);

  if (mode === "collapsed") return <ChipVariant recorder={recorder} />;
  return <ExpandedVariant integrated={integrated} recorder={recorder} />;
}
