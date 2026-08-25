import type {
  CommandAction,
  CommandActionGroup,
  CommandActionSection,
  CommandContextDefinition,
  CommandPlugin,
  CommandPluginExecutionArgs,
  CommandRouteInfo,
  ResolvedCommandAction,
} from "./types";

const DEFAULT_PRIORITY = 0;

export interface ResolveCommandContextsArgs<TContext, THelpers> {
  route: CommandRouteInfo;
  contexts: CommandContextDefinition<TContext, THelpers>[];
  defaults?: CommandContextDefinition<TContext, THelpers>[];
}

export interface ResolvedCommandContext<TContext, THelpers = unknown> {
  definition: CommandContextDefinition<TContext, THelpers>;
  context: TContext;
}

export interface ResolveCommandActionsArgs<TContext, THelpers> {
  helpers: THelpers;
  contexts: ResolvedCommandContext<TContext, THelpers>[];
}

export interface ResolveCommandPluginsArgs<TContext, THelpers, TAction extends CommandAction<TContext, THelpers>> {
  helpers: THelpers;
  contexts: ResolvedCommandContext<TContext, THelpers>[];
  plugins: CommandPlugin<TContext, THelpers, TAction>[];
}

export interface BuildCommandSectionsArgs<TAction extends Pick<ResolvedCommandAction, "group">> {
  actions: TAction[];
  groupOrder?: CommandActionGroup[];
  titleByGroup?: Partial<Record<CommandActionGroup, string>>;
}

export function resolveCommandContexts<TContext, THelpers>({
  route,
  contexts,
  defaults = [],
}: ResolveCommandContextsArgs<TContext, THelpers>): ResolvedCommandContext<TContext, THelpers>[] {
  const matchedDefinitions = contexts.filter((candidate) => candidate.matches(route));
  const orderedDefinitions = [...defaults, ...matchedDefinitions].sort(compareContextDefinitions);

  return orderedDefinitions.flatMap((definition) => {
    const context = definition.resolve(route);

    if (!context) {
      return [];
    }

    return [
      {
        definition,
        context,
      },
    ];
  });
}

export function resolveCommandActions<
  TContext,
  THelpers,
  TAction extends CommandAction<TContext, THelpers>,
>(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _args: ResolveCommandActionsArgs<TContext, THelpers>,
): ResolvedCommandAction<TAction>[] {
  return [];
}

export function resolveCommandPlugins<
  TContext,
  THelpers,
  TAction extends CommandAction<TContext, THelpers>,
>({
  helpers,
  contexts,
  plugins,
}: ResolveCommandPluginsArgs<TContext, THelpers, TAction>): ResolvedCommandAction<TAction>[] {
  const activeContexts = contexts.map(({ context }) => context);
  const pluginArgs: CommandPluginExecutionArgs<TContext, THelpers> = {
    contexts: activeContexts,
    helpers,
  };

  const activePlugins = [...plugins]
    .filter((plugin) => plugin.matches?.(pluginArgs) ?? true)
    .sort(comparePlugins);

  let actions = activePlugins.flatMap((plugin) =>
    plugin.getActions(pluginArgs).map((action) => ({
      ...action,
      contextId: plugin.id,
    })),
  ) as ResolvedCommandAction<TAction>[];

  for (const plugin of activePlugins) {
    if (!plugin.adjustActions) {
      continue;
    }

    actions = plugin.adjustActions({
      ...pluginArgs,
      actions: actions.map(stripResolvedActionContext),
    }).map((action) => {
      const existing = actions.find((candidate) => candidate.id === action.id);

      return {
        ...action,
        contextId: existing?.contextId ?? plugin.id,
      } as ResolvedCommandAction<TAction>;
    });
  }

  return actions
    .filter((action) => !(action.isRedundant?.({ context: findActionContext(action, contexts), helpers }) ?? false))
    .slice()
    .sort(compareActions)
    .reduce<ResolvedCommandAction<TAction>[]>((resolved, action) => {
      if (action.intentBehavior === "keep-all") {
        resolved.push(action);
        return resolved;
      }

      const hasIntentWinner = resolved.some(
        (candidate) =>
          candidate.intent === action.intent &&
          candidate.intentBehavior !== "keep-all",
      );

      if (!hasIntentWinner) {
        resolved.push(action);
      }

      return resolved;
    }, []);
}

export function buildCommandSections<TAction extends Pick<ResolvedCommandAction, "group">>({
  actions,
  groupOrder = [],
  titleByGroup = {},
}: BuildCommandSectionsArgs<TAction>): CommandActionSection<TAction>[] {
  const orderedGroups = new Set<CommandActionGroup>(groupOrder);
  const discoveredGroups = actions.map((action) => action.group);

  for (const group of discoveredGroups) {
    orderedGroups.add(group);
  }

  return Array.from(orderedGroups)
    .map((group) => {
      const groupActions = actions.filter((action) => action.group === group);

      if (groupActions.length === 0) {
        return null;
      }

      return {
        id: group,
        title: titleByGroup[group] ?? startCase(group),
        actions: groupActions,
      };
    })
    .filter((section): section is CommandActionSection<TAction> => section !== null);
}

function compareActions<TContext, THelpers>(
  left: CommandAction<TContext, THelpers>,
  right: CommandAction<TContext, THelpers>,
) {
  const priorityDelta =
    (right.priority ?? DEFAULT_PRIORITY) - (left.priority ?? DEFAULT_PRIORITY);

  if (priorityDelta !== 0) {
    return priorityDelta;
  }

  const intentComparison = left.intent.localeCompare(right.intent);
  if (intentComparison !== 0) {
    return intentComparison;
  }

  return left.title.localeCompare(right.title);
}

function compareContextDefinitions<TContext, THelpers>(
  left: CommandContextDefinition<TContext, THelpers>,
  right: CommandContextDefinition<TContext, THelpers>,
) {
  return (right.priority ?? DEFAULT_PRIORITY) - (left.priority ?? DEFAULT_PRIORITY);
}

function comparePlugins<TContext, THelpers, TAction extends CommandAction<TContext, THelpers>>(
  left: CommandPlugin<TContext, THelpers, TAction>,
  right: CommandPlugin<TContext, THelpers, TAction>,
) {
  return (right.priority ?? DEFAULT_PRIORITY) - (left.priority ?? DEFAULT_PRIORITY);
}

function stripResolvedActionContext<TAction extends CommandAction<any, any>>(
  action: ResolvedCommandAction<TAction>,
): TAction {
  const baseAction = { ...action };
  delete (baseAction as Partial<ResolvedCommandAction<TAction>>).contextId;
  return baseAction as unknown as TAction;
}

function findActionContext<TContext, TAction extends CommandAction<TContext, any>>(
  action: ResolvedCommandAction<TAction>,
  contexts: ResolvedCommandContext<TContext, any>[],
) {
  return contexts.find(({ definition }) => definition.id === action.contextId)?.context ?? contexts[0]!.context;
}

function startCase(value: string) {
  return value
    .split(/[-_\s]+/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
