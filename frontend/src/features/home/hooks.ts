"use client";

import { useQuery } from "@tanstack/react-query";
import { homeApi } from "./api";

export const homeKeys = {
  all: ["home"] as const,
  data: () => [...homeKeys.all, "data"] as const,
};

export function useHomeData() {
  return useQuery({
    queryKey: homeKeys.data(),
    queryFn: homeApi.getHome,
    staleTime: 15_000,
    refetchOnWindowFocus: true,
    refetchOnMount: "always",
  });
}
