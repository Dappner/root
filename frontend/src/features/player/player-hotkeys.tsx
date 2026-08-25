"use client";

import { useDialogStore } from "@/components/dialogs";
import { useKeyboardShortcut } from "@/hooks/use-keyboard-shortcut";
import { usePlayerStore } from "@/features/player/store";

export function PlayerHotkeys() {
  const hasSource = usePlayerStore((s) => s.activeSource !== null);
  const mode = usePlayerStore((s) => s.mode);
  const dialogOpen = useDialogStore((state) => state.open);
  const enabled = hasSource && !dialogOpen;

  useKeyboardShortcut(() => usePlayerStore.getState().toggle(), {
    code: "Space",
    enabled,
  });

  useKeyboardShortcut(() => usePlayerStore.getState().skip(-10), {
    code: "ArrowLeft",
    enabled,
  });

  useKeyboardShortcut(() => usePlayerStore.getState().skip(10), {
    code: "ArrowRight",
    enabled,
  });

  useKeyboardShortcut(
    () => {
      const store = usePlayerStore.getState();
      if (mode === "expanded") store.collapse();
      else store.expand();
    },
    { code: "ArrowUp", enabled },
  );

  return null;
}
