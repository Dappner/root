/**
 * Command Palette Feature
 *
 * Context-aware command menu for quick navigation and actions
 *
 * Usage:
 * ```tsx
 * import { useCommandPalette, CommandPalette } from "@/features/command-palette";
 *
 * // In root layout (includes keyboard listener):
 * <CommandPalette />
 *
 * // Programmatic control:
 * const { open, close, toggle } = useCommandPalette();
 * open(); // Context auto-detected from current route
 * ```
 */

export { useCommandPalette } from "@/components/command-palette/store";
export { CommandPalette } from "./command-palette";
export type { AppCommandAction, AppCommandGroup } from "./app/types";
export type { AppCommandContext } from "./app/contexts";
export { useCommandPaletteState } from "./use-command-palette-state";
export {
  buildCommandSections,
} from "@/components/command-palette/core/resolve-actions";
export {
  createEmptyShortcutState,
  matchShortcut,
} from "@/components/command-palette/core/shortcuts";
export { matchActions } from "@/components/command-palette/core/match-actions";
