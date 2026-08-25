import { cn } from "@/lib/utils";
import { ChevronUp, Sparkles } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";
import { ShimmerLabel } from "./streaming-text";

interface ReasoningPanelProps {
  /** Reasoning text streamed so far. */
  text: string;
  /** True while thought deltas are still arriving. */
  streaming?: boolean;
  /** Wall-clock duration of the reasoning phase; shown once settled. */
  durationMs?: number;
  className?: string;
}

function formatDuration(ms: number) {
  const seconds = Math.round(ms / 1000);
  if (seconds < 1) return "a moment";
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${seconds % 60}s`;
}

/**
 * Collapsible reasoning trace, styled as transcript rather than as a widget.
 *
 * Auto-expands while thinking and folds away once the answer begins, on the
 * theory that live reasoning is interesting and stale reasoning is clutter. The
 * first manual toggle latches and the panel stops moving on its own.
 */
export function ReasoningPanel({
  text,
  streaming = false,
  durationMs,
  className,
}: ReasoningPanelProps) {
  const [override, setOverride] = useState<boolean | null>(null);
  const open = override ?? streaming;
  const scrollRef = useRef<HTMLDivElement>(null);

  // Pin to the newest reasoning as it arrives. Layout effect so the scroll lands
  // in the same frame as the text, avoiding a visible jump.
  useLayoutEffect(() => {
    if (!open || !streaming) return;
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [text, open, streaming]);

  if (!text && !streaming) return null;

  const label = streaming
    ? "Thinking"
    : durationMs !== undefined
      ? `Thought for ${formatDuration(durationMs)}`
      : "Thought process";

  return (
    <div className={cn("flex flex-col gap-1 text-[13px]", className)}>
      <div className="flex min-h-5 items-center gap-1.5">
        <Sparkles className="-ml-px size-3.5 flex-none text-muted-foreground" strokeWidth={1.8} />

        <span className="inline-flex min-w-0 items-center gap-1 font-medium whitespace-nowrap">
          <span className="min-w-0 truncate">
            <ShimmerLabel active={streaming}>{label}</ShimmerLabel>
          </span>

          <button
            type="button"
            aria-label="Toggle reasoning"
            aria-expanded={open}
            onClick={() => setOverride(!open)}
            className={cn(
              "inline-flex size-4 flex-none items-center justify-center rounded",
              "text-muted-foreground/60 transition-all duration-300 hover:text-muted-foreground",
              "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
              "motion-reduce:transition-none",
              !open && "rotate-180",
            )}
          >
            <ChevronUp className="size-2.5" strokeWidth={1.8} />
          </button>
        </span>
      </div>

      <div
        className={cn(
          "grid transition-[grid-template-rows,opacity] duration-300 motion-reduce:transition-none",
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        )}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="flex items-stretch gap-1.5">
            <span className="ml-[5.5px] w-px flex-none self-stretch border-l border-border" />
            <div className="relative min-w-0 flex-1 py-1 pl-1.5">
              {/* Edge fades signalling scrollable overflow in both directions. */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-0 z-10 h-4 bg-gradient-to-b from-background to-transparent"
              />
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-4 bg-gradient-to-t from-background to-transparent"
              />
              <div ref={scrollRef} className="max-h-[180px] overflow-y-auto">
                <p className="text-xs leading-[18px] whitespace-pre-wrap text-muted-foreground">
                  {text}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
