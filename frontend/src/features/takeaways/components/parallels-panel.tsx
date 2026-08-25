"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { colorForSource } from "@/features/graph/lib/colors";
import { useTakeawayParallels } from "@/features/takeaways/hooks";
import type { ParallelTakeawayDTO } from "@/features/takeaways/types";
import { Network } from "lucide-react";
import { Link } from "@/lib/nav";

interface ParallelsPanelProps {
  takeawayId: number;
}

/**
 * Cross-source parallels for a takeaway — semantically nearest takeaways from
 * *other* sources. Surfaces the recognition step that drives note drafting on
 * the synthesis ladder (capture → takeaway → note across sources).
 *
 * Renders nothing when there are no parallels above the similarity floor: an
 * empty panel would train the user to ignore the rest of the page.
 */
export function ParallelsPanel({ takeawayId }: ParallelsPanelProps) {
  const { data, isPending, isError } = useTakeawayParallels(takeawayId);

  if (isPending) {
    return <ParallelsSkeleton />;
  }

  if (isError || !data || data.length === 0) {
    return null;
  }

  return (
    <section className="space-y-4">
      <h3 className="font-semibold text-sm uppercase text-muted-foreground flex items-center gap-2">
        <Network className="w-4 h-4" />
        Parallels in Other Sources ({data.length})
      </h3>
      <div className="grid grid-cols-1 gap-4">
        {data.map((parallel) => (
          <ParallelCard key={parallel.takeaway_id} parallel={parallel} />
        ))}
      </div>
    </section>
  );
}

function ParallelCard({ parallel }: { parallel: ParallelTakeawayDTO }) {
  // Two-decimal score (matches mockup, reads as a similarity number rather
  // than a "percent confidence" — honest about what it is).
  const similarity = parallel.similarity.toFixed(2);
  // Same palette as the mini-graph so a source reads as the same color
  // wherever it appears on the page.
  const sourceColor = colorForSource(parallel.source_id);

  return (
    <Link
      href={`/library/${parallel.source_id}/takeaways/${parallel.takeaway_id}`}
      className="block group"
    >
      <Card
        className="bg-muted/30 border-muted transition-colors group-hover:border-foreground/30 group-hover:bg-muted/50 h-full"
        style={{ borderLeftColor: sourceColor, borderLeftWidth: 3 }}
      >
        <CardContent className="py-3 px-3 space-y-1.5">
          {/* Single-line metadata strip: kind, source title, similarity score.
              Reads at a glance; no row per field. */}
          <div className="flex items-center gap-2 text-[11px] min-w-0">
            <span
              className="uppercase tracking-wider font-semibold shrink-0"
              style={{ color: sourceColor }}
            >
              {parallel.source_type}
            </span>
            <span className="text-muted-foreground truncate min-w-0 flex-1">
              {parallel.source_title}
            </span>
            <span className="text-muted-foreground font-mono shrink-0">
              {similarity}
            </span>
          </div>

          <h4 className="font-semibold text-sm leading-snug line-clamp-2">
            {parallel.title}
          </h4>

          {parallel.snippet && (
            <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
              {parallel.snippet}
            </p>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}

function ParallelsSkeleton() {
  return (
    <section className="space-y-4">
      <Skeleton className="h-4 w-48" />
      <div className="grid grid-cols-1 gap-4">
        {[0, 1].map((i) => (
          <Card key={i} className="bg-muted/30 border-muted">
            <CardContent className="pt-6 space-y-3">
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-32" />
              </div>
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
