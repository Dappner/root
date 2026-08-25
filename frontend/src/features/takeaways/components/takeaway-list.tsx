"use client";

import { Button } from "@/components/ui/button";
import { routes } from "@/lib/routes";
import { Plus, Star } from "lucide-react";
import { useRouter } from "@/lib/nav";
import { useTakeaways } from "../hooks";
import { TakeawayEmptyState } from "./takeaway-empty-state";
import { TakeawayRow } from "./takeaway-row";

interface TakeawayListProps {
  sourceId: number;
}

export function TakeawayList({ sourceId }: TakeawayListProps) {
  const { data: takeaways, isLoading } = useTakeaways(sourceId);
  const router = useRouter();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Star className="h-5 w-5 fill-amber-400 text-amber-400" />
            Key takeaways
          </h3>

          <div className="py-4 text-sm text-muted-foreground">Loading takeaways...</div>;
        </div>
      </div>
    )
  }

  const count = takeaways?.length ?? 0;
  const canAddMore = count < 5;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Star className="h-5 w-5 fill-amber-400 text-amber-400" />
          Key takeaways ({count}/5)
        </h3>
        {count > 0 && canAddMore && (
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

      {/* Empty State or Takeaway Rows */}
      {count === 0 ? (
        <TakeawayEmptyState sourceId={sourceId} />
      ) : (
        <div className="space-y-2 divide-y">
          {takeaways?.map((takeaway) => (
            <TakeawayRow
              key={takeaway.id}
              sourceId={sourceId}
              takeaway={takeaway}
            />
          ))}
        </div>
      )}
    </div>
  );
}
