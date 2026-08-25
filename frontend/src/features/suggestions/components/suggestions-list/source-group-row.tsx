"use client";

import { createElement, type KeyboardEvent } from "react";
import { ChevronRight } from "lucide-react";

import { getSourceIcon, getSourceLabel } from "@/features/sources/utils/source-type-meta";
import { timeAgo } from "@/lib/utils/date";
import { cn } from "@/lib/utils";

import type { SourceSuggestionGroup } from "../../utils";
import { getGroupMetaLine } from "../../utils";

interface SourceGroupRowProps {
  group: SourceSuggestionGroup;
  /** Opens the full-screen reviewer for this source group. */
  onReview: (sourceId: number) => void;
}

/**
 * A single clickable row per source. Replaces the old one-card-per-note list:
 * sources that produced many voice notes collapse into one entry showing a
 * roll-up. Clicking the row launches the full-screen reviewer for the group.
 */
export function SourceGroupRow({ group, onReview }: SourceGroupRowProps) {
  const sourceType = group.source?.type;
  const typeLabel = `${getSourceLabel(sourceType)} capture`;
  const title = group.source?.title ?? `Source ${group.sourceId}`;
  const meta = getGroupMetaLine(group);

  const open = () => onReview(group.sourceId);
  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      open();
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={open}
      onKeyDown={handleKeyDown}
      className={cn(
        "group flex w-full cursor-pointer items-stretch gap-3 rounded-xl border bg-card px-3 py-3 text-left transition-colors",
        "hover:border-foreground/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        {createElement(getSourceIcon(sourceType), { className: "h-5 w-5" })}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">{typeLabel}</span>
          <span className="shrink-0 text-xs text-muted-foreground">
            {timeAgo(new Date(group.latestAt).toISOString())}
          </span>
        </div>

        <span className="line-clamp-2 text-sm font-medium leading-snug" title={title}>
          {title}
        </span>

        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-xs text-muted-foreground">{meta}</span>
          {group.avgConfidence != null && (
            <span className="shrink-0 text-xs font-medium tabular-nums text-emerald-500">
              {group.avgConfidence}%
            </span>
          )}
        </div>
      </div>

      <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/50 group-hover:text-muted-foreground" />
    </div>
  );
}
