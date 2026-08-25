import { cn } from "@/lib/utils";

/**
 * Semantic accent for a citation. Backed by dedicated `--citation-*` theme
 * tokens (not the chart ramp, whose hues differ between light and dark) so a
 * quote reads violet and an insight amber in both themes.
 */
export type CitationTone = "quote" | "note" | "insight" | "section" | "transcript";

const TONE_CLASSES: Record<CitationTone, string> = {
  quote: "text-citation-quote bg-citation-quote/10 hover:bg-citation-quote/20",
  note: "text-citation-note bg-citation-note/10 hover:bg-citation-note/20",
  insight: "text-citation-insight bg-citation-insight/10 hover:bg-citation-insight/20",
  section: "text-citation-section bg-citation-section/10 hover:bg-citation-section/20",
  transcript:
    "text-citation-transcript bg-citation-transcript/10 hover:bg-citation-transcript/20",
};

const TONE_BADGE: Record<CitationTone, string> = {
  quote: "text-citation-quote bg-citation-quote/10",
  note: "text-citation-note bg-citation-note/10",
  insight: "text-citation-insight bg-citation-insight/10",
  section: "text-citation-section bg-citation-section/10",
  transcript: "text-citation-transcript bg-citation-transcript/10",
};

interface CitationMarkerProps {
  /** Display number, e.g. 3 renders as a superscript "3". */
  label: string | number;
  tone?: CitationTone;
  onClick?: () => void;
  className?: string;
}

/**
 * Superscript reference marker rendered inline in prose.
 *
 * Sized in `em` so it tracks the surrounding type rather than fighting it, and
 * kept to a tight hit area so a dense paragraph does not become a minefield of
 * overlapping targets.
 */
export function CitationMarker({ label, tone = "quote", onClick, className }: CitationMarkerProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "mx-px inline-flex min-w-[1.25em] cursor-pointer items-center justify-center rounded",
        "px-[0.3em] py-px align-super text-[0.68em] leading-none font-semibold tabular-nums",
        "transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        TONE_CLASSES[tone],
        className,
      )}
    >
      {label}
    </button>
  );
}

interface CitationBadgeProps {
  tone: CitationTone;
  children: React.ReactNode;
  className?: string;
}

/** Small kind-label ("Quote", "Note", …) used in the reference footer. */
export function CitationBadge({ tone, children, className }: CitationBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5",
        "text-[10px] font-medium tracking-wide uppercase",
        TONE_BADGE[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
