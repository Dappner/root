"use client";

import type { SourceTakeawayDTO } from "@/features/takeaways/types";
import { Card } from "@/components/ui/card";
import { routes } from "@/lib/routes";
import { ChevronRight } from "lucide-react";
import { useRouter } from "@/lib/nav";

interface TakeawayRowProps {
  sourceId: number;
  takeaway: SourceTakeawayDTO;
}

export function TakeawayRow({ sourceId, takeaway }: TakeawayRowProps) {
  const router = useRouter();

  const citationCount = takeaway.citations?.length ?? 0;
  const captureCount = takeaway.captures?.length ?? 0;

  const handleClick = () => {
    router.push(routes.sourceTakeaway(sourceId, takeaway.id));
  };

  return (
    <Card
      className="flex flex-row items-start justify-between gap-4 py-3 px-4 hover:bg-muted/50 rounded-md cursor-pointer transition-colors"
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleClick();
        }
      }}
    >
      <div className="flex-1 space-y-1">
        <h4 className="font-semibold text-base">{takeaway.title}</h4>

        {takeaway.body && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {takeaway.body}
          </p>
        )}

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {citationCount > 0 && (
            <span>
              {citationCount} quote{citationCount !== 1 ? "s" : ""}
            </span>
          )}
          {citationCount > 0 && captureCount > 0 && <span>·</span>}
          {captureCount > 0 && (
            <span>
              {captureCount} note{captureCount !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>

      <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0 mt-1" />
    </Card>
  );
}
