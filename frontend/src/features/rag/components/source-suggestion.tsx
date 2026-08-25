"use client";

import { cn } from "@/lib/utils";
import { SourceIcon } from "@/features/sources/components/source-header/components/source-icon";
import type { SourceType } from "@/features/sources/types";

interface SourceSuggestionProps {
  entry: {
    id: number | string;
    display?: string;
    type?: SourceType;
    author?: string;
  };
  search: string;
  highlightedDisplay: React.ReactNode | string;
  index: number;
  focused: boolean;
}

export function SourceSuggestion({
  entry,
  focused,
}: SourceSuggestionProps) {
  const type = entry.type as SourceType | undefined;

  return (
    <div
      className={cn(
        "flex items-center gap-3 px-3 py-2 text-sm cursor-pointer rounded-none transition-colors",
        focused ? "bg-accent text-accent-foreground" : "hover:bg-muted/50"
      )}
    >
      {type && (
        <SourceIcon
          type={type}
          className="h-4 w-4 text-muted-foreground shrink-0"
        />
      )}
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate">{entry.display ?? "Untitled Source"}</div>
        {entry.author && (
          <div className="text-xs text-muted-foreground truncate">
            {entry.author}
          </div>
        )}
      </div>
    </div>
  );
}
