"use client";

import { useMemo } from "react";
import type { GlobalShortcutConfig, GlobalShortcutMode } from "@/components/command-palette/core/shortcuts";
import { useLocalStorage, LOCAL_STORAGE_KEYS } from "@/hooks/use-local-storage";

export type CommandPaletteShortcutPreference = Extract<GlobalShortcutMode, "disabled" | "leader">;

export const DEFAULT_GLOBAL_SHORTCUT_MODE: CommandPaletteShortcutPreference = "leader";
export const DEFAULT_GLOBAL_SHORTCUT_TIMEOUT_MS = 500;
export const DEFAULT_GLOBAL_SHORTCUT_LEADER_KEY = ";";

export function useCommandPaletteGlobalShortcutMode() {
  return useLocalStorage<CommandPaletteShortcutPreference>(
    LOCAL_STORAGE_KEYS.COMMAND_PALETTE_GLOBAL_SHORTCUT_MODE,
    DEFAULT_GLOBAL_SHORTCUT_MODE,
  );
}

export function useCommandPaletteGlobalShortcutConfig(): GlobalShortcutConfig {
  const [mode] = useCommandPaletteGlobalShortcutMode();

  return useMemo(
    () => ({
      mode,
      leaderKey: DEFAULT_GLOBAL_SHORTCUT_LEADER_KEY,
      timeoutMs: DEFAULT_GLOBAL_SHORTCUT_TIMEOUT_MS,
    }),
    [mode],
  );
}
