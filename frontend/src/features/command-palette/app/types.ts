import type { LucideIcon } from "lucide-react";

export type AppCommandGroup = "context" | "navigation" | "actions";

export interface AppCommandAction {
  id: string;
  intent: string;
  intentBehavior?: "collapse" | "keep-all";
  title: string;
  group: AppCommandGroup;
  icon: LucideIcon;
  description?: string;
  keywords?: string[];
  shortcut?: string[];
  priority?: number;
  run: () => void | Promise<void>;
  isRedundant?: () => boolean;
}
