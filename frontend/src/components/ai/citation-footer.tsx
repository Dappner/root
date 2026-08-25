import { cn } from "@/lib/utils";
import { ChevronUp, Link2 } from "lucide-react";
import { useState } from "react";

interface CitationFooterProps {
  /** Number of references, shown in the trigger. */
  count: number;
  children: React.ReactNode;
  className?: string;
}

/**
 * Collapsible source list under an answer.
 *
 * Shares the header + rail treatment used by tool activity and reasoning so the
 * whole transcript reads as one surface instead of three different widgets.
 */
export function CitationFooter({ count, children, className }: CitationFooterProps) {
  const [open, setOpen] = useState(false);

  if (count === 0) return null;

  return (
    <div className={cn("flex flex-col gap-1 text-[13px]", className)}>
      <div className="flex min-h-5 items-center gap-1.5">
        <Link2 className="-ml-px size-3.5 flex-none text-muted-foreground" strokeWidth={1.8} />

        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((prev) => !prev)}
          className={cn(
            "inline-flex min-w-0 items-center gap-1 rounded font-medium whitespace-nowrap",
            "text-muted-foreground transition-colors hover:text-foreground",
            "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
          )}
        >
          {count} source{count === 1 ? "" : "s"}
          <ChevronUp
            className={cn(
              "size-2.5 flex-none text-muted-foreground/60 transition-transform duration-300",
              "motion-reduce:transition-none",
              !open && "rotate-180",
            )}
            strokeWidth={1.8}
          />
        </button>
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
            <div className="flex min-w-0 flex-1 flex-col gap-2.5 py-1 pl-1.5">{children}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface CitationGroupProps {
  /** Source title, optionally rendered as a link by the caller. */
  heading: React.ReactNode;
  /** Reference count within this source. */
  count: number;
  children: React.ReactNode;
}

/** One source's references — a heading line followed by its entries. */
export function CitationGroup({ heading, count, children }: CitationGroupProps) {
  return (
    <div className="min-w-0">
      <div className="flex items-baseline gap-1.5 text-xs">
        <span className="min-w-0 truncate font-medium text-foreground">{heading}</span>
        <span className="flex-none text-muted-foreground/60">·</span>
        <span className="flex-none tabular-nums text-muted-foreground">
          {count} ref{count === 1 ? "" : "s"}
        </span>
      </div>
      <div className="mt-1 space-y-1.5">{children}</div>
    </div>
  );
}
