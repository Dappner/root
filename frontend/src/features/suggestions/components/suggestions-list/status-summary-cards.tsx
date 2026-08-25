"use client";

import { CheckCircle2, Clock, CircleAlert, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

import type { SuggestionStatusFilter } from "./types";

interface StatusSummaryCardsProps {
  counts: { ready: number; processing: number; failed: number };
  /** The currently active filter — the matching card is highlighted. */
  active: SuggestionStatusFilter;
  onSelect: (filter: SuggestionStatusFilter) => void;
}

/** The three statuses that get a summary card (dismissed is tab-only). */
type SummaryFilter = "ready" | "processing" | "failed";

interface CardConfig {
  filter: SummaryFilter;
  label: string;
  sublabel: string;
  icon: LucideIcon;
  /** Accent classes for the icon + count. */
  accent: string;
}

const CARDS: CardConfig[] = [
  {
    filter: "ready",
    label: "Ready",
    sublabel: "Needs your review",
    icon: CheckCircle2,
    accent: "text-emerald-500",
  },
  {
    filter: "processing",
    label: "Processing",
    sublabel: "Being prepared",
    icon: Clock,
    accent: "text-amber-500",
  },
  {
    filter: "failed",
    label: "Failed",
    sublabel: "Needs attention",
    icon: CircleAlert,
    accent: "text-destructive",
  },
];

export function StatusSummaryCards({ counts, active, onSelect }: StatusSummaryCardsProps) {
  return (
    <div className="grid grid-cols-3 gap-3">
      {CARDS.map((card) => {
        const count = counts[card.filter];
        const isActive = active === card.filter;
        const Icon = card.icon;
        return (
          <button
            key={card.filter}
            type="button"
            onClick={() => onSelect(isActive ? "all" : card.filter)}
            aria-pressed={isActive}
            className={cn(
              "flex cursor-pointer flex-col gap-2 rounded-xl border bg-card px-4 py-3 text-left transition-colors",
              "hover:border-foreground/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              isActive && "border-foreground/30 bg-accent/40",
            )}
          >
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Icon className={cn("h-3.5 w-3.5", card.accent)} />
              <span>{card.label}</span>
            </div>
            <span className={cn("text-2xl font-semibold tabular-nums", card.accent)}>
              {count}
            </span>
            <span className="text-xs text-muted-foreground">{card.sublabel}</span>
          </button>
        );
      })}
    </div>
  );
}
