"use client";

import { Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useRouter } from "@/lib/nav";

import { useSourceSuggestions } from "../hooks";

interface SourceSuggestionsNudgeProps {
  sourceId: number;
}

export function SourceSuggestionsNudge({ sourceId }: SourceSuggestionsNudgeProps) {
  const router = useRouter();
  const { data = [], isLoading } = useSourceSuggestions(sourceId);

  const suggestions = data.filter(
    (s) =>
      s.status === "uploaded" ||
      s.status === "processing" ||
      s.status === "ready" ||
      s.status === "failed",
  );

  if (isLoading || suggestions.length === 0) return null;

  const readyCount = suggestions.filter((s) => s.status === "ready").length;
  const failedCount = suggestions.filter((s) => s.status === "failed").length;
  const processingCount = suggestions.filter(
    (s) => s.status === "uploaded" || s.status === "processing"
  ).length;

  const label =
    readyCount > 0
      ? `${readyCount} suggestion${readyCount !== 1 ? "s" : ""} ready to review`
      : failedCount > 0
      ? `${failedCount} suggestion${failedCount !== 1 ? "s" : ""} failed`
      : `${processingCount} suggestion${processingCount !== 1 ? "s" : ""} processing`;

  const canOpen = readyCount > 0 || failedCount > 0;

  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground">
      <div className="flex items-center gap-2 min-w-0">
        <Sparkles className="h-3.5 w-3.5 shrink-0 text-primary" />
        <span className="truncate">{label}</span>
      </div>
      {canOpen && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 shrink-0"
          onClick={() => router.push(`/library/${sourceId}/transcript?review=1`)}
        >
          Review
        </Button>
      )}
    </div>
  );
}
