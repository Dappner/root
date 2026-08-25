"use client";

import { useLocalStorage, LOCAL_STORAGE_KEYS } from "@/hooks/use-local-storage";

export type DashboardMode = "zen" | "analytical";

export const DEFAULT_DASHBOARD_MODE: DashboardMode = "zen";

export function useDashboardMode() {
  return useLocalStorage<DashboardMode>(
    LOCAL_STORAGE_KEYS.DASHBOARD_MODE,
    DEFAULT_DASHBOARD_MODE,
  );
}
