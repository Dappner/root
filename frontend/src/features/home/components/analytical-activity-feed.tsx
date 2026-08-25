"use client";

import { Link } from "@/lib/nav";
import { Mic, Quote, StickyNote } from "lucide-react";
import { routes } from "@/lib/routes";
import { timeAgo } from "@/lib/utils/date";
import type { HomeRecentHighlight } from "../types";

interface AnalyticalActivityFeedProps {
  highlights: HomeRecentHighlight[];
  isLoading?: boolean;
}

// Group raw highlights into semantic activity items
interface ActivityItem {
  key: string;
  icon: React.ElementType;
  label: string;
  sub: string;
  href: string;
  ts: string;
}

function groupHighlights(highlights: HomeRecentHighlight[]): ActivityItem[] {
  // Aggregate citations from the same source into one entry
  const citationsBySource = new Map<string, HomeRecentHighlight[]>();
  const standalone: HomeRecentHighlight[] = [];

  for (const h of highlights) {
    if (h.kind === "citation" && h.source_id) {
      const key = String(h.source_id);
      const group = citationsBySource.get(key) ?? [];
      group.push(h);
      citationsBySource.set(key, group);
    } else {
      standalone.push(h);
    }
  }

  const items: ActivityItem[] = [];

  // Emit one entry per source group
  for (const [, group] of citationsBySource) {
    const first = group[0];
    const sourceName = first.source_title ?? "a source";
    const count = group.length;
    const isVoice = group.some((h) => h.info_type?.toLowerCase().includes("voice"));
    const label =
      count === 1
        ? `Captured a highlight from ${sourceName}`
        : `Captured ${count} highlights from ${sourceName}`;
    const icon = isVoice ? Mic : Quote;
    // Single citation → deep-link to it; multiple → land on the highlights tab.
    const href = first.source_id
      ? count === 1
        ? `/library/${first.source_id}/highlights?citation=${first.id}`
        : `/library/${first.source_id}/highlights`
      : "/library";

    items.push({
      key: `citations-${first.source_id}`,
      icon,
      label,
      sub: sourceName,
      href,
      ts: first.created_at,
    });
  }

  // Emit one entry per standalone (notes / unsorted)
  for (const h of standalone) {
    if (h.kind === "capture") {
      const href = h.source_id
        ? `/library/${h.source_id}/highlights?capture=${h.id}`
        : "/library";
      items.push({
        key: `capture-${h.id}`,
        icon: StickyNote,
        label: h.source_title ? `Note in ${h.source_title}` : "Updated a note",
        sub: h.source_title ?? "Unsorted",
        href,
        ts: h.created_at,
      });
    } else {
      const href = h.source_id
        ? `/library/${h.source_id}/highlights?citation=${h.id}`
        : "/library";
      items.push({
        key: `citation-${h.id}`,
        icon: Quote,
        label: "Captured a highlight",
        sub: h.source_title ?? "Unsorted",
        href,
        ts: h.created_at,
      });
    }
  }

  // Sort by most recent and cap at 5
  return items
    .sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime())
    .slice(0, 5);
}

export function AnalyticalActivityFeed({ highlights, isLoading }: AnalyticalActivityFeedProps) {
  const items = isLoading ? [] : groupHighlights(highlights);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Recent activity</h3>
        <Link href={routes.library} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
          View all
        </Link>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-3 animate-pulse">
              <div className="h-9 w-9 rounded-lg bg-muted shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 w-44 bg-muted rounded" />
                <div className="h-2.5 w-28 bg-muted rounded" />
              </div>
              <div className="h-2.5 w-10 bg-muted rounded shrink-0" />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="text-xs text-muted-foreground py-6">No recent activity yet.</p>
      ) : (
        <div className="space-y-0.5">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.key}
                href={item.href}
                className="flex items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-muted/50 transition-colors group"
              >
                <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm leading-snug line-clamp-2">{item.label}</p>
                </div>
                <span className="text-xs text-muted-foreground shrink-0 tabular-nums whitespace-nowrap">
                  {timeAgo(item.ts)}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
