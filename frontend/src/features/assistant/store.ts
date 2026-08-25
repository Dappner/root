"use client";

import { create } from "zustand";
import type { RootAssistantContext } from "./types";

interface AssistantPanelState {
  open: boolean;
  context: RootAssistantContext;
  draft: string;
  openAssistant: (options?: {
    context?: RootAssistantContext;
    draft?: string;
  }) => void;
  closeAssistant: () => void;
  setDraft: (draft: string) => void;
}

export const useAssistantPanel = create<AssistantPanelState>((set) => ({
  open: false,
  context: { surface: "library" },
  draft: "",
  openAssistant: (options) =>
    set({
      open: true,
      context: options?.context ?? { surface: "library" },
      draft: options?.draft ?? "",
    }),
  closeAssistant: () => set({ open: false }),
  setDraft: (draft) => set({ draft }),
}));
