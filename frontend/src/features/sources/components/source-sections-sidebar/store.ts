"use client";

import { useEffect } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";

const WIDE_BREAKPOINT_PX = 1400;
const DEFAULT_WIDTH_PX = 360;

interface SourceSectionsSidebarState {
  isOpen: boolean;
  width: number;
  activeSourceId: number | null;
  setOpen: (open: boolean) => void;
  toggle: () => void;
  setWidth: (width: number) => void;
  setActiveSourceId: (sourceId: number | null) => void;
}

const initialOpen =
  typeof window !== "undefined" && window.innerWidth >= WIDE_BREAKPOINT_PX;

export const useSourceSectionsSidebar = create<SourceSectionsSidebarState>()(
  persist(
    (set, get) => ({
      isOpen: initialOpen,
      width: DEFAULT_WIDTH_PX,
      activeSourceId: null,
      setOpen: (open) => set({ isOpen: open }),
      toggle: () => set({ isOpen: !get().isOpen }),
      setWidth: (width) => set({ width }),
      setActiveSourceId: (sourceId) => set({ activeSourceId: sourceId }),
    }),
    {
      name: "source-sections-sidebar",
      partialize: (state) => ({ isOpen: state.isOpen, width: state.width }),
    },
  ),
);

/**
 * Publishes the current source to the sidebar host while the calling page is mounted.
 * The host (rendered at the authenticated layout level) reads this to know what sections
 * to display. Clears on unmount so the panel hides when navigating away from a source.
 */
export function useRegisterSectionsSidebar(sourceId: number) {
  const setActiveSourceId = useSourceSectionsSidebar((s) => s.setActiveSourceId);

  useEffect(() => {
    setActiveSourceId(sourceId);
    return () => setActiveSourceId(null);
  }, [sourceId, setActiveSourceId]);
}
