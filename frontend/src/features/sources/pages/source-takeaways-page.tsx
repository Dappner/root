"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useTakeaways } from "@/features/takeaways/hooks";
import type { SourceTakeawayDTO } from "@/features/takeaways/types";
import { routes } from "@/lib/routes";
import { BookMarked, MessageSquareQuote, Plus, Star } from "lucide-react";
import { useRouter } from "@/lib/nav";

interface SourceTakeawaysPageProps {
  sourceId: number;
}

function TakeawayCard({ takeaway, sourceId }: { takeaway: SourceTakeawayDTO; sourceId: number }) {
  const router = useRouter();
  const citationCount = takeaway.citations?.length ?? 0;
  const captureCount = takeaway.captures?.length ?? 0;

  return (
    <Card
      className="p-5 space-y-3 hover:bg-muted/50 cursor-pointer transition-colors"
      onClick={() => router.push(routes.sourceTakeaway(sourceId, takeaway.id))}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          router.push(routes.sourceTakeaway(sourceId, takeaway.id));
        }
      }}
    >
      <h3 className="font-semibold text-base">{takeaway.title}</h3>

      {takeaway.body && (
        <p className="text-sm text-muted-foreground leading-relaxed">{takeaway.body}</p>
      )}

      {(citationCount > 0 || captureCount > 0) && (
        <div className="flex items-center gap-4 pt-1 text-xs text-muted-foreground">
          {citationCount > 0 && (
            <span className="flex items-center gap-1">
              <MessageSquareQuote className="h-3.5 w-3.5" />
              {citationCount} quote{citationCount !== 1 ? "s" : ""}
            </span>
          )}
          {captureCount > 0 && (
            <span className="flex items-center gap-1">
              <BookMarked className="h-3.5 w-3.5" />
              {captureCount} note{captureCount !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      )}
    </Card>
  );
}

export function SourceTakeawaysPage({ sourceId }: SourceTakeawaysPageProps) {
  const { data: takeaways, isLoading } = useTakeaways(sourceId);
  const router = useRouter();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-9 w-36" />
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="border rounded-lg p-5 space-y-3">
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-3 w-24" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const count = takeaways?.length ?? 0;
  const canAddMore = count < 5;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Star className="h-5 w-5 fill-amber-400 text-amber-400" />
          Key takeaways ({count}/5)
        </h2>
        {canAddMore && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push(routes.sourceTakeawayNew(sourceId))}
          >
            <Plus className="h-4 w-4 mr-1" />
            New takeaway
          </Button>
        )}
      </div>

      {count === 0 ? (
        <div className="rounded-lg border bg-muted/20 py-12 text-center space-y-4">
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            You haven&apos;t distilled this yet. Pick a few quotes and notes, then create your
            first takeaway.
          </p>
          <Button onClick={() => router.push(routes.sourceTakeawayNew(sourceId))}>
            Start a takeaway
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {takeaways?.map((takeaway) => (
            <TakeawayCard key={takeaway.id} takeaway={takeaway} sourceId={sourceId} />
          ))}
        </div>
      )}
    </div>
  );
}
