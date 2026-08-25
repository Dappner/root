"use client";

import { ChevronDown, SlidersHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

import type { SuggestionSort, SuggestionStatusFilter } from "./types";

interface FilterSortRowProps {
  filter: SuggestionStatusFilter;
  onFilterChange: (filter: SuggestionStatusFilter) => void;
  /** Per-tab counts. `dismissed` is optional — unknown until its lazy fetch loads. */
  counts: {
    all: number;
    ready: number;
    processing: number;
    failed: number;
    dismissed?: number;
  };
  sort: SuggestionSort;
  onSortChange: (sort: SuggestionSort) => void;
}

const TABS: { value: SuggestionStatusFilter; label: string }[] = [
  { value: "ready", label: "Ready" },
  { value: "processing", label: "Processing" },
  { value: "failed", label: "Failed" },
  { value: "dismissed", label: "Dismissed" },
];

const SORT_LABELS: Record<SuggestionSort, string> = {
  recent: "Most recent",
  oldest: "Oldest first",
  confidence: "Confidence",
};

export function FilterSortRow({
  filter,
  onFilterChange,
  counts,
  sort,
  onSortChange,
}: FilterSortRowProps) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-1">
        {TABS.map((tab) => {
          const isActive = filter === tab.value;
          const count = counts[tab.value];
          return (
            <button
              key={tab.value}
              type="button"
              onClick={() => onFilterChange(tab.value)}
              className={cn(
                "flex cursor-pointer items-center gap-1.5 rounded-md px-2.5 py-1 text-sm transition-colors",
                isActive
                  ? "bg-accent text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <span>{tab.label}</span>
              {count != null && (
                <span
                  className={cn(
                    "text-xs tabular-nums",
                    isActive ? "text-foreground/70" : "text-muted-foreground/70",
                  )}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-1">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs">
                <span>{SORT_LABELS[sort]}</span>
                <ChevronDown className="h-3 w-3" />
              </Button>
            }
          />
          <DropdownMenuContent align="end">
            <DropdownMenuRadioGroup
              value={sort}
              onValueChange={(value) => onSortChange(value as SuggestionSort)}
            >
              {(Object.keys(SORT_LABELS) as SuggestionSort[]).map((value) => (
                <DropdownMenuRadioItem key={value} value={value}>
                  {SORT_LABELS[value]}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 text-muted-foreground"
          aria-label="Filter"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
