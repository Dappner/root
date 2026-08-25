import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AvailableModelId, ReasoningLevel } from "./types";

interface RagState {
  modelId: AvailableModelId;
  reasoningLevel: ReasoningLevel;

  // Actions
  setModel: (id: AvailableModelId, defaultReasoningLevel: ReasoningLevel) => void;
  setReasoningLevel: (level: ReasoningLevel) => void;
}

export const useRagStore = create<RagState>()(
  persist(
    (set) => ({
      modelId: "",
      reasoningLevel: null,

      setModel: (id, defaultReasoningLevel) => {
        set({
          modelId: id,
          reasoningLevel: defaultReasoningLevel,
        });
      },

      setReasoningLevel: (level) => {
        set({ reasoningLevel: level });
      },
    }),
    {
      name: "rag-preferences", // unique name for localStorage key
      partialize: (state) => ({
        modelId: state.modelId,
        reasoningLevel: state.reasoningLevel,
      }), // Only persist these fields
    }
  )
);
