"use client";

import { ActivityChart } from "./activity-chart";
import { FocusAreasCard } from "./focus-areas-card";
import { StatsGrid } from "./stats-grid";
import type { UserStats } from "../types";

interface StatsOverviewProps {
  stats: UserStats;
  weeksBack?: number;
  onWeeksBackChange?: (weeksBack: number) => void;
  isRefetching?: boolean;
}

export function StatsOverview({
  stats,
  weeksBack,
  onWeeksBackChange,
  isRefetching,
}: StatsOverviewProps) {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border/60 bg-card/40 p-6">
        <StatsGrid counts={stats.counts} monthDelta={stats.month_delta} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ActivityChart
          trends={stats.weekly_trends}
          weeksBack={weeksBack}
          onWeeksBackChange={onWeeksBackChange}
          isRefetching={isRefetching}
        />
        <FocusAreasCard areas={stats.focus_areas} />
      </div>
    </div>
  );
}
