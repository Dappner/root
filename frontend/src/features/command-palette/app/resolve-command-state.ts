import { buildCommandSections } from "@/components/command-palette/core/resolve-actions";
import type { AppCommandAction } from "./types";
import type { AppCommandContext } from "./contexts";

export interface ResolvedCommandState {
  contexts: AppCommandContext[];
  actions: AppCommandAction[];
  sections: ReturnType<typeof buildCommandSections<AppCommandAction>>;
}

export function resolveCommandState(
  contexts: AppCommandContext[],
  actions: AppCommandAction[],
): ResolvedCommandState {
  const activeContextType = contexts.find(
    (c) => c.type === "source" || c.type === "collection",
  )?.type;

  const contextTitle = activeContextType
    ? activeContextType.charAt(0).toUpperCase() + activeContextType.slice(1)
    : "Actions";

  const filtered = actions
    .filter((a) => !(a.isRedundant?.() ?? false))
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))
    .reduce<AppCommandAction[]>((acc, action) => {
      if (action.intentBehavior === "keep-all") {
        acc.push(action);
        return acc;
      }
      if (!acc.some((a) => a.intent === action.intent)) {
        acc.push(action);
      }
      return acc;
    }, []);

  const sections = buildCommandSections({
    actions: filtered,
    groupOrder: ["context", "navigation", "actions"],
    titleByGroup: {
      context: contextTitle,
      navigation: "Navigation",
      actions: "Actions",
    },
  });

  return { contexts, actions: filtered, sections };
}
