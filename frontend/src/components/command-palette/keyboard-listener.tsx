"use client";

import { useEffect, useRef } from "react";
import {
  advanceGlobalShortcut,
  createEmptyGlobalShortcutState,
  type GlobalShortcutConfig,
} from "./core/shortcuts";
import { useCommandPalette } from "./store";

export interface ShortcutAction {
  id: string;
  shortcut?: string[];
  run: () => void | Promise<void>;
}

interface CommandPaletteKeyboardListenerProps {
  actions: ShortcutAction[];
  config: GlobalShortcutConfig;
}

export function CommandPaletteKeyboardListener({
  actions,
  config,
}: CommandPaletteKeyboardListenerProps) {
  const isOpen = useCommandPalette((state) => state.isOpen);
  const toggle = useCommandPalette((state) => state.toggle);
  const setLeaderModeActive = useCommandPalette((state) => state.setLeaderModeActive);

  const { mode, leaderKey, timeoutMs } = config;

  const shortcutStateRef = useRef(createEmptyGlobalShortcutState());
  const leaderTimeoutRef = useRef<number | null>(null);
  const isOpenRef = useRef(isOpen);
  const actionsRef = useRef(actions);
  const configRef = useRef(config);

  useEffect(() => { isOpenRef.current = isOpen; }, [isOpen]);
  useEffect(() => { actionsRef.current = actions; }, [actions]);
  useEffect(() => { configRef.current = config; }, [config]);

  useEffect(() => {
    const clearLeaderTimeout = () => {
      if (leaderTimeoutRef.current !== null) {
        window.clearTimeout(leaderTimeoutRef.current);
        leaderTimeoutRef.current = null;
      }
    };

    const resetLeaderState = () => {
      clearLeaderTimeout();
      shortcutStateRef.current = createEmptyGlobalShortcutState();
      setLeaderModeActive(false);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        toggle();
        resetLeaderState();
        return;
      }

      if (isOpenRef.current || e.metaKey || e.ctrlKey || e.altKey) {
        return;
      }

      const target = e.target as HTMLElement | null;
      if (
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable
      ) {
        return;
      }

      const currentConfig = configRef.current;
      // Adapt ShortcutAction to the shape advanceGlobalShortcut expects
      const adapted = actionsRef.current.map((a) => ({
        ...a,
        intent: a.id,
        title: a.id,
        group: "actions" as const,
        contextId: "global",
        run: () => a.run(),
      }));

      const result = advanceGlobalShortcut(
        adapted as Parameters<typeof advanceGlobalShortcut>[0],
        e.key,
        shortcutStateRef.current,
        currentConfig,
      );

      shortcutStateRef.current = result.state;
      setLeaderModeActive(currentConfig.mode === "leader" && result.state.armed);

      clearLeaderTimeout();
      if (currentConfig.mode === "leader" && result.state.armed) {
        leaderTimeoutRef.current = window.setTimeout(resetLeaderState, currentConfig.timeoutMs ?? 500);
      }

      if (!result.consumed && !result.action) return;

      e.preventDefault();

      if (result.action) {
        void result.action.run({ context: undefined as never, helpers: undefined as never });
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      clearLeaderTimeout();
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [toggle, setLeaderModeActive]);

  // Reset shortcut state when config or open state changes
  useEffect(() => {
    if (leaderTimeoutRef.current !== null) {
      window.clearTimeout(leaderTimeoutRef.current);
      leaderTimeoutRef.current = null;
    }
    shortcutStateRef.current = createEmptyGlobalShortcutState();
    setLeaderModeActive(false);
  }, [mode, leaderKey, timeoutMs, isOpen, setLeaderModeActive]);

  return null;
}
