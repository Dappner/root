import { create } from "zustand";

interface CommandPaletteStore {
  isOpen: boolean;
  resetOnOpen: boolean;
  isLeaderModeActive: boolean;
  open: (options?: { reset?: boolean }) => void;
  close: () => void;
  closeAll: () => void;
  toggle: () => void;
  setLeaderModeActive: (active: boolean) => void;
}

export const useCommandPalette = create<CommandPaletteStore>((set) => ({
  isOpen: false,
  resetOnOpen: true,
  isLeaderModeActive: false,
  open: (options) => set({ isOpen: true, resetOnOpen: options?.reset ?? false, isLeaderModeActive: false }),
  close: () => set({ isOpen: false, isLeaderModeActive: false }),
  closeAll: () => set({ isOpen: false, isLeaderModeActive: false }),
  toggle: () => set((state) => ({ isOpen: !state.isOpen, resetOnOpen: true, isLeaderModeActive: false })),
  setLeaderModeActive: (active) => set({ isLeaderModeActive: active }),
}));
