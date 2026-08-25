import { useQuery } from "@tanstack/react-query";
import { takeawaysApi } from "./api";
import { takeawayKeys } from "./query-keys";

const DEFAULT_LIMIT = 20;

export function useRecentTakeaways(limit: number = DEFAULT_LIMIT, offset: number = 0) {
  return useQuery({
    queryKey: takeawayKeys.recentList(limit, offset),
    queryFn: () => takeawaysApi.listRecent(limit, offset),
    staleTime: 60_000,
  });
}
