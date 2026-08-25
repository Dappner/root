import { cn } from "@/lib/utils";
import { ChevronUp, CircleCheck, Search, type LucideIcon } from "lucide-react";
import { useState } from "react";
import { GlobeSpinner } from "./globe-spinner";
import { ShimmerLabel } from "./streaming-text";

export type ToolActivityStatus = "pending" | "done" | "error";

/** Per-row lifecycle: queued → being fetched → resolved. */
export type ResultState = "pending" | "loading" | "done";

interface ActivityResultProps {
  state: ResultState;
  /** Primary label — the thing that was found. */
  title: string;
  /** Secondary label — source, host, or location. */
  detail?: string | null;
  onClick?: () => void;
}

/**
 * One result row.
 *
 * The bullet holds all three state icons stacked and cross-fades between them,
 * so the transition is a morph in place rather than a layout-shifting swap.
 */
export function ActivityResult({ state, title, detail, onClick }: ActivityResultProps) {
  const isDone = state === "done";
  const interactive = isDone && Boolean(onClick);

  return (
    <li
      className={cn(
        "group flex min-w-0 items-center gap-1.5 text-xs leading-[18px]",
        "animate-in fade-in slide-in-from-bottom-1 duration-300 motion-reduce:animate-none",
        interactive && "cursor-pointer",
      )}
      onClick={interactive ? onClick : undefined}
    >
      <span className="relative inline-flex size-3 flex-none items-center justify-center">
        {/* Queued: dashed ring. */}
        <span
          className={cn(
            "absolute inset-0 inline-flex items-center justify-center text-muted-foreground/60",
            "transition-opacity duration-300 motion-reduce:transition-none",
            state === "pending" ? "opacity-100" : "opacity-0",
          )}
        >
          <svg viewBox="0 0 24 24" className="size-3" fill="none" stroke="currentColor" aria-hidden>
            <circle
              cx="12"
              cy="12"
              r="9"
              strokeWidth="1.8"
              strokeDasharray="1.8 3.6"
              strokeLinecap="round"
            />
          </svg>
        </span>

        {/* Fetching: rotating globe. Hidden under reduced motion, which leaves
            the dashed ring visible as a static stand-in. */}
        <span
          className={cn(
            "absolute inset-0 inline-flex items-center justify-center text-muted-foreground/70",
            "transition-all duration-300 motion-reduce:transition-none",
            state === "loading"
              ? "scale-100 opacity-100 motion-reduce:opacity-0"
              : isDone
                ? "scale-[0.775] opacity-0"
                : "scale-90 opacity-0",
          )}
        >
          <GlobeSpinner />
        </span>

        {/* Resolved: check. */}
        <span
          className={cn(
            "inline-flex items-center justify-center text-primary",
            "transition-all delay-75 duration-200 motion-reduce:transition-none",
            isDone ? "scale-100 opacity-100" : "scale-110 opacity-0",
          )}
        >
          <CircleCheck className="size-3" strokeWidth={1.6} />
        </span>
      </span>

      <span
        className={cn(
          "flex-none truncate font-normal",
          state === "pending" && "text-muted-foreground",
          isDone && "text-foreground",
        )}
      >
        {state === "loading" ? <ShimmerLabel>{title}</ShimmerLabel> : title}
      </span>

      {detail && (
        <>
          <span className="flex-none text-muted-foreground/60">·</span>
          <span
            className={cn(
              "min-w-0 flex-1 truncate text-muted-foreground transition-colors",
              interactive && "group-hover:text-foreground",
            )}
          >
            {detail}
          </span>
          {interactive && (
            <span
              className={cn(
                "-ml-0.5 inline-flex flex-none rotate-45 text-muted-foreground/60",
                "translate-y-0.5 opacity-0 transition-all duration-200",
                "group-hover:translate-y-0 group-hover:opacity-100",
                "motion-reduce:transition-none",
              )}
            >
              <svg
                viewBox="0 0 24 24"
                className="size-2.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M4.5 10.5 12 3m0 0 7.5 7.5M12 3v18" />
              </svg>
            </span>
          )}
        </>
      )}
    </li>
  );
}

interface ToolActivityProps {
  status: ToolActivityStatus;
  /** Leading glyph for the header row. Defaults to a magnifier. */
  icon?: LucideIcon;
  /** Header verb phrase, e.g. "Searching your library". */
  label: string;
  /** Quoted subject shown after the label — the query or target. */
  subject?: string | null;
  /** Result rows; when present the header gains a collapse toggle. */
  children?: React.ReactNode;
  className?: string;
}

/**
 * Header + indented result list for a tool invocation.
 *
 * Deliberately chrome-free — no card, border, or fill. The activity reads as
 * part of the transcript rather than a widget pasted into it, which is what
 * keeps a run of several tool calls from looking like a stack of boxes.
 */
export function ToolActivity({
  status,
  icon: Icon = Search,
  label,
  subject,
  children,
  className,
}: ToolActivityProps) {
  const [open, setOpen] = useState(true);
  const isPending = status === "pending";

  return (
    <div className={cn("flex flex-col gap-1 text-[13px]", className)}>
      <div className="flex min-h-5 items-center gap-1.5">
        <Icon
          className={cn(
            "-ml-px size-3.5 flex-none",
            status === "error" ? "text-destructive" : "text-muted-foreground",
          )}
          strokeWidth={1.8}
        />

        <span className="inline-flex min-w-0 items-center gap-1 font-medium whitespace-nowrap">
          <span className="min-w-0 truncate">
            <ShimmerLabel active={isPending}>
              {label}
              {subject && <span className="ml-1 font-normal">&ldquo;{subject}&rdquo;</span>}
            </ShimmerLabel>
          </span>

          {children && (
            <button
              type="button"
              aria-label="Toggle results"
              aria-expanded={open}
              onClick={() => setOpen((prev) => !prev)}
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
          )}
        </span>
      </div>

      {children && (
        // grid-rows 1fr → 0fr animates to the content's natural height, which a
        // max-height transition can only approximate.
        <div
          className={cn(
            "grid transition-[grid-template-rows,opacity] duration-300 motion-reduce:transition-none",
            open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
          )}
        >
          <div className="min-h-0 overflow-hidden">
            <div className="flex items-stretch gap-1.5">
              <span className="ml-[5.5px] w-px flex-none self-stretch border-l border-border" />
              <ul className="flex min-w-0 flex-1 list-none flex-col gap-1.5 py-1 pl-1.5">
                {children}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
