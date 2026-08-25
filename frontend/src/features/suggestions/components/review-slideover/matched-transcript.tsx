"use client";

import { useMemo, useState } from "react";

import type { TranscriptUtterance } from "@/features/podcasts/types";
import type { TranscriptV1Location } from "@/features/suggestions/types";
import { locateByTime } from "@/features/suggestions/transcript-locate";
import { formatTime } from "@/lib/utils/time";
import { cn } from "@/lib/utils";

/** Character budget for neighbouring (non-matched) context before "Show more". */
const NEIGHBOR_CHAR_BUDGET = 320;
/** Max characters of a long matched utterance to show around the quote collapsed. */
const MATCHED_PREVIEW_CHARS = 360;

interface MatchedTranscriptProps {
  utterances: TranscriptUtterance[];
  location: TranscriptV1Location;
  /** The quoted text, used to locate the excerpt within a long utterance. */
  quoteText: string;
}

interface Row {
  utterance: TranscriptUtterance;
  index: number;
  matched: boolean;
}

export function MatchedTranscript({ utterances, location, quoteText }: MatchedTranscriptProps) {
  const [expanded, setExpanded] = useState(false);

  // Locate the matched utterances by TIME, not by the saved indices — those go
  // stale when the transcript is re-sectioned, but timestamps stay authoritative.
  const { matchStart, matchEnd } = useMemo(
    () => locateByTime(utterances, location.tStartSec, location.tEndSec),
    [utterances, location.tStartSec, location.tEndSec],
  );

  if (matchStart === -1) return null;

  const total = utterances.length;

  // Grow neighbours outward from the matched range until a character budget is
  // hit, so one giant monologue neighbour can't flood the panel.
  const { windowStart, windowEnd } = expanded
    ? { windowStart: Math.max(0, matchStart - 4), windowEnd: Math.min(total - 1, matchEnd + 4) }
    : growWithinBudget(utterances, matchStart, matchEnd, NEIGHBOR_CHAR_BUDGET);

  const rows: Row[] = [];
  for (let i = windowStart; i <= windowEnd; i++) {
    const u = utterances[i];
    if (u) rows.push({ utterance: u, index: i, matched: i >= matchStart && i <= matchEnd });
  }

  const canExpand = windowStart > 0 || windowEnd < total - 1 || hasTruncatedMatch(rows, quoteText, expanded);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Matched transcript</span>
          <span>·</span>
          <span className="tabular-nums">
            {formatTime(location.tStartSec)} – {formatTime(location.tEndSec)}
          </span>
        </div>
        {canExpand && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="text-xs text-emerald-500 hover:text-emerald-400"
          >
            {expanded ? "Show less" : "Show more"}
          </button>
        )}
      </div>

      <div className="overflow-hidden rounded-md border">
        {rows.map((row) => (
          <div
            key={row.index}
            className={cn(
              "flex gap-3 px-3 py-2 text-sm leading-relaxed",
              row.matched
                ? "bg-emerald-500/10 text-emerald-800 dark:text-emerald-200/90"
                : "text-muted-foreground",
            )}
          >
            <span className="shrink-0 pt-0.5 text-xs tabular-nums text-muted-foreground/70">
              {formatTime(row.utterance.start)}
            </span>
            <span className="min-w-0 whitespace-pre-wrap">
              {row.matched
                ? renderMatchedText(row.utterance.text, quoteText, expanded)
                : row.utterance.text}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Find the utterance index range whose time spans overlap [tStart, tEnd]. */
/**
 * Grow neighbours outward from the matched range, alternating before/after, but
 * never add a neighbour that would push total neighbour text past the budget.
 * A single giant monologue neighbour is therefore skipped rather than shown.
 */
function growWithinBudget(
  utterances: TranscriptUtterance[],
  matchStart: number,
  matchEnd: number,
  budget: number,
): { windowStart: number; windowEnd: number } {
  let windowStart = matchStart;
  let windowEnd = matchEnd;
  let spent = 0;
  let beforeBlocked = false;
  let afterBlocked = false;
  let preferBefore = true;

  while (!beforeBlocked || !afterBlocked) {
    const tryBefore = preferBefore ? !beforeBlocked : afterBlocked;
    preferBefore = !preferBefore;

    if (tryBefore) {
      const idx = windowStart - 1;
      const len = idx >= 0 ? utterances[idx].text.length : 0;
      if (idx < 0 || spent + len > budget) beforeBlocked = true;
      else {
        windowStart = idx;
        spent += len;
      }
    } else {
      const idx = windowEnd + 1;
      const len = idx < utterances.length ? utterances[idx].text.length : 0;
      if (idx >= utterances.length || spent + len > budget) afterBlocked = true;
      else {
        windowEnd = idx;
        spent += len;
      }
    }
  }
  return { windowStart, windowEnd };
}

/** Whether any matched row's text is long enough to be truncated when collapsed. */
function hasTruncatedMatch(rows: Row[], quoteText: string, expanded: boolean): boolean {
  if (expanded) return false;
  return rows.some(
    (r) => r.matched && r.utterance.text.length > MATCHED_PREVIEW_CHARS && r.utterance.text.length > quoteText.length,
  );
}

/**
 * For a long matched utterance, show a window of text centred on the quote when
 * collapsed (with ellipses), and the full text when expanded.
 */
function renderMatchedText(text: string, quoteText: string, expanded: boolean): string {
  if (expanded || text.length <= MATCHED_PREVIEW_CHARS) return text;

  const quoteIdx = quoteText ? text.indexOf(quoteText.trim().slice(0, 40)) : -1;
  if (quoteIdx === -1) {
    return `${text.slice(0, MATCHED_PREVIEW_CHARS).trimEnd()}…`;
  }

  const pad = Math.floor((MATCHED_PREVIEW_CHARS - quoteText.length) / 2);
  const start = Math.max(0, quoteIdx - Math.max(40, pad));
  const end = Math.min(text.length, quoteIdx + quoteText.length + Math.max(40, pad));
  const prefix = start > 0 ? "…" : "";
  const suffix = end < text.length ? "…" : "";
  return `${prefix}${text.slice(start, end).trim()}${suffix}`;
}
