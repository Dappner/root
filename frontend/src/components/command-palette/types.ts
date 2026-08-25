import type { LucideIcon } from "lucide-react";
import type {
  CommandAction as CoreCommandAction,
  CommandActionGroup as CoreCommandActionGroup,
  CommandActionSection,
  CommandContextDefinition,
  CommandExecutionArgs,
  CommandPlugin,
  CommandPluginExecutionArgs,
  CommandRouteInfo,
  ResolvedCommandAction,
} from "./core/types";

/**
 * Command group categories
 */
export type CommandGroup = CoreCommandActionGroup | "search" | "settings";

/**
 * Command definition
 */
export interface Command {
  id: string;
  label: string;
  icon: LucideIcon;
  description?: string;
  keywords?: string[];
  shortcut?: string[]; // e.g., ["ctrl", "n"] for future shortcut display
  action: () => void | Promise<void>;
  group: CommandGroup;
  path?: string; // Optional route for filtering current-page nav items
  enabled?: () => boolean; // Future: conditional commands
  isCurrent?: boolean;
}

export type CommandAction<TContext = unknown, THelpers = unknown> = CoreCommandAction<
  TContext,
  THelpers
>;
export type {
  CommandActionSection,
  CommandContextDefinition,
  CommandExecutionArgs,
  CommandPlugin,
  CommandPluginExecutionArgs,
  CommandRouteInfo,
  ResolvedCommandAction,
};
