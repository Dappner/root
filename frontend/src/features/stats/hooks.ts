"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { statsApi } from "./api";
import { statsKeys } from "./keys";

const STALE_TIME = 5 * 60 * 1000;

export function useMyStats(weeksBack?: number) {
  return useQuery({
    queryKey: statsKeys.me(weeksBack),
    queryFn: () => statsApi.getMine(weeksBack),
    staleTime: STALE_TIME,
    placeholderData: keepPreviousData,
  });
}

export function useUserStats(userId: string, weeksBack?: number) {
  return useQuery({
    queryKey: statsKeys.user(userId, weeksBack),
    queryFn: () => statsApi.getForUser(userId, weeksBack),
    enabled: !!userId,
    staleTime: STALE_TIME,
    placeholderData: keepPreviousData,
  });
}
