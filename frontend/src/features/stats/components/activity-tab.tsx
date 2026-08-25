"use client";

import { Loader2 } from "lucide-react";
import { useState } from "react";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
} from "@/components/ui/empty";
import { useMyStats } from "../hooks";
import { DEFAULT_WEEKS_BACK } from "../range";
import { ActivityChart } from "./activity-chart";

export function ActivityTab() {
  const [weeksBack, setWeeksBack] = useState<number>(DEFAULT_WEEKS_BACK);
  const { data, isLoading, isFetching, error } = useMyStats(weeksBack);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <Empty className="py-12 rounded-xl">
        <EmptyHeader>
          <EmptyDescription className="text-destructive">
            {error instanceof Error
              ? error.message
              : "Failed to load your activity"}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="space-y-6">
      <ActivityChart
        trends={data.weekly_trends}
        weeksBack={weeksBack}
        onWeeksBackChange={setWeeksBack}
        isRefetching={isFetching}
      />
    </div>
  );
}
