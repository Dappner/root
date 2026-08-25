"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { SourceAbout } from "@/features/sources/components/source-about";
import { SourceRecentNotes } from "@/features/sources/components/source-recent-notes";
import { useRegisterSectionsSidebar } from "@/features/sources/components/source-sections-sidebar/store";
import { SourceSummary } from "@/features/sources/components/source-summary";
import { useSource } from "@/features/sources/hooks/sources";
import { SourceSuggestionsNudge } from "@/features/suggestions/components/source-suggestions-nudge";
import { TakeawayList } from "@/features/takeaways/components/takeaway-list";

interface SourceOverviewPageProps {
  sourceId: number;
}

export function SourceOverviewPage({ sourceId }: SourceOverviewPageProps) {
  useRegisterSectionsSidebar(sourceId);
  const { data, isLoading } = useSource(sourceId);
  const source = data;

  if (isLoading) {
    return (
      <div className="grid grid-cols-12 gap-8">
        {/* Summary Skeleton */}
        <div className="col-span-12 md:col-span-5 space-y-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-6 w-24" />
            <Skeleton className="h-8 w-16" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-4/5" />
          </div>
        </div>

        {/* Takeaways Skeleton */}
        <div className="col-span-12 md:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-9 w-40" />
          </div>
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="border rounded-lg p-4 space-y-3">
                <Skeleton className="h-5 w-3/4" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!source) return null;

  return (
    <div className="grid grid-cols-12 gap-8">
      <div className="col-span-12 md:col-span-5 space-y-8">
        <SourceSuggestionsNudge sourceId={sourceId} />
        <SourceSummary source={source} />
        <SourceAbout source={source} />
        <SourceRecentNotes sourceId={sourceId} />
      </div>

      <div className="col-span-12 md:col-span-7">
        <TakeawayList sourceId={sourceId} />
      </div>
    </div>
  );
}
