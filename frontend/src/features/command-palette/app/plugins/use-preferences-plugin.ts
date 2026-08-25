"use client";

import { LayoutDashboard, Moon } from "lucide-react";
import { useTheme } from "next-themes";
import { useDashboardMode } from "@/features/home/preferences";
import { runChangeThemeFlow, runChangeDashboardModeFlow } from "../flows/preference-flows";
import type { AppCommandAction } from "../types";

export function usePreferencesPlugin(): AppCommandAction[] {
  const { theme, setTheme } = useTheme();
  const [dashboardMode, setDashboardMode] = useDashboardMode();

  return [
    {
      id: "pref-theme",
      intent: "change-theme",
      title: "Change Theme",
      icon: Moon,
      keywords: ["theme", "dark", "light", "system", "appearance", "mode"],
      shortcut: ["p", "t"],
      group: "actions",
      priority: 20,
      run: () => runChangeThemeFlow(theme, setTheme),
    },
    {
      id: "pref-dashboard-layout",
      intent: "change-dashboard-layout",
      title: "Change Dashboard Layout",
      icon: LayoutDashboard,
      keywords: ["dashboard", "layout", "zen", "analytical", "mode", "home"],
      shortcut: ["p", "d"],
      group: "actions",
      priority: 10,
      run: () => runChangeDashboardModeFlow(dashboardMode, setDashboardMode),
    },
  ];
}
