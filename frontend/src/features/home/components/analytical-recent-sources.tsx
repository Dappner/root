"use client";

import { Link } from "@/lib/nav";
import { ChevronRight } from "lucide-react";
import { SourceIcon } from "@/features/sources/components/source-header/components/source-icon";
import { routes } from "@/lib/routes";
import { timeAgo } from "@/lib/utils/date";
import type { HomeRecentSource } from "../types";

interface AnalyticalRecentSourcesProps {
  sources: HomeRecentSource[];
  isLoading?: boolean;
}

const TYPE_LABEL: Record<string, string> = {
  podcast: "Podcast",
  video: "Video",
  book: "Book",
  article: "Article",
  pdf: "PDF",
};

export function AnalyticalRecentSources({ sources, isLoading }: AnalyticalRecentSourcesProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Recent sources</h3>
        <Link href={routes.library} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
          View all
        </Link>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3 animate-pulse p-2">
              <div className="h-12 w-12 rounded-lg bg-muted shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-3.5 w-40 bg-muted rounded" />
                <div className="h-2.5 w-24 bg-muted rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : sources.length === 0 ? (
        <p className="text-xs text-muted-foreground py-6">No recent sources.</p>
      ) : (
        <div className="space-y-0.5">
          {sources.map(({ source, last_activity_at }) => {
            if (!source) return null;
            const lastActive = last_activity_at ? timeAgo(last_activity_at) : null;
            const captureCount = (source.capture_count ?? 0) + (source.citation_count ?? 0);
            const typeLabel = TYPE_LABEL[source.type] ?? source.type;

            return (
              <Link
                key={source.id}
                href={`/library/${source.id}`}
                className="flex items-center gap-4 rounded-xl px-2 py-3.5 hover:bg-muted/60 transition-colors group"
              >
                {/* Thumbnail */}
                <div className="h-14 w-14 rounded-lg overflow-hidden shrink-0 bg-muted flex items-center justify-center">
                  {source.image_url ? (
                    <img
                      src={source.image_url}
                      alt={source.title}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <SourceIcon type={source.type} className="h-6 w-6 text-muted-foreground" />
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0 space-y-1.5">
                  <p className="text-sm font-semibold leading-tight truncate">{source.title}</p>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70 bg-muted px-1.5 py-0.5 rounded">
                      {typeLabel}
                    </span>
                    {captureCount > 0 && (
                      <span className="text-[11px] text-muted-foreground/60">{captureCount} saved</span>
                    )}
                  </div>
                </div>

                {/* Time + arrow */}
                <div className="flex items-center gap-0.5 shrink-0 tabular-nums">
                  {lastActive && <span className="text-[11px] text-muted-foreground/50">{lastActive}</span>}
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/25 group-hover:text-muted-foreground/50 transition-colors" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
