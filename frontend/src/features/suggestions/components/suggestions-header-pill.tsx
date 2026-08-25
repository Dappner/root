"use client";

import { Link } from "@/lib/nav";
import { AudioWaveform } from "lucide-react";

import { routes } from "@/lib/routes";
import { usePendingSuggestions } from "../hooks";

export function SuggestionsHeaderPill() {
  const { data: suggestions } = usePendingSuggestions();
  const readyCount = suggestions.filter((s) => s.status === "ready").length;

  if (suggestions.length === 0) return null;

  return (
    <Link
      href={routes.suggestions}
      className="flex items-center gap-1.5 rounded-full border border-border/60 bg-background px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-border hover:text-foreground"
    >
      <AudioWaveform className="h-3 w-3 shrink-0" />
      <span>
        {readyCount} capture{readyCount !== 1 ? "s" : ""} ready to review
      </span>
    </Link>
  );
}
