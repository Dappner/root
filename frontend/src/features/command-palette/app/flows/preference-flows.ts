import { createElement } from "react";
import { Check } from "lucide-react";
import { openSimplePickerResultAsync, type SimplePickerOption } from "@/components/pickers";
import type { DashboardMode } from "@/features/home/preferences";

type ThemeChoice = "light" | "dark" | "system";

function activeRender(label: string, description: string, active: boolean) {
  const ActiveRender = () =>
    createElement(
      "div",
      { className: "flex w-full items-center justify-between gap-2" },
      createElement(
        "div",
        { className: "flex flex-col gap-0.5" },
        createElement("span", null, label),
        createElement("span", { className: "text-xs text-muted-foreground" }, description),
      ),
      active
        ? createElement(Check, { className: "h-4 w-4 shrink-0 text-primary" })
        : null,
    );
  ActiveRender.displayName = "ActiveRender";
  return ActiveRender;
}

function buildThemeOptions(currentTheme: string | undefined): SimplePickerOption<ThemeChoice>[] {
  return [
    { label: "Light", value: "light", description: "Always use light mode", render: activeRender("Light", "Always use light mode", currentTheme === "light") },
    { label: "Dark", value: "dark", description: "Always use dark mode", render: activeRender("Dark", "Always use dark mode", currentTheme === "dark") },
    { label: "System", value: "system", description: "Follow your OS setting", render: activeRender("System", "Follow your OS setting", currentTheme === "system" || !currentTheme) },
  ];
}

function buildDashboardOptions(currentMode: DashboardMode): SimplePickerOption<DashboardMode>[] {
  return [
    { label: "Zen", value: "zen", description: "Calm, focused view with primary source and suggestions", render: activeRender("Zen", "Calm, focused view with primary source and suggestions", currentMode === "zen") },
    { label: "Analytical", value: "analytical", description: "Data-rich overview with stats, trends, and activity", render: activeRender("Analytical", "Data-rich overview with stats, trends, and activity", currentMode === "analytical") },
  ];
}

export async function runChangeThemeFlow(currentTheme: string | undefined, setTheme: (theme: string) => void) {
  const selection = await openSimplePickerResultAsync({
    title: "Change Theme",
    items: buildThemeOptions(currentTheme),
  });

  if (selection.kind !== "selected") return;
  setTheme(selection.item);
}

export async function runChangeDashboardModeFlow(currentMode: DashboardMode, setMode: (mode: DashboardMode) => void) {
  const selection = await openSimplePickerResultAsync({
    title: "Change Dashboard Layout",
    items: buildDashboardOptions(currentMode),
  });

  if (selection.kind !== "selected") return;
  setMode(selection.item);
}
