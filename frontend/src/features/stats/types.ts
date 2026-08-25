export type {
  FocusArea,
  StatsCounts,
  TakeawayOfDay,
  UserStatsResponse as UserStats,
  WeeklyTrend,
} from "@/features/rag/rag-api.generated";

import type {
  StatsCounts as GeneratedStatsCounts,
} from "@/features/rag/rag-api.generated";

export type StatsMonthDelta = GeneratedStatsCounts;
