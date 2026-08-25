export type CommandActionGroup = "navigation" | "actions" | (string & {});

export interface CommandRouteInfo {
  pathname: string | null;
  params?: Record<string, string | string[] | undefined>;
}

export interface CommandExecutionArgs<TContext, THelpers> {
  context: TContext;
  helpers: THelpers;
}

export interface CommandPluginExecutionArgs<TContext, THelpers> {
  contexts: TContext[];
  helpers: THelpers;
}

export interface CommandAction<TContext = unknown, THelpers = unknown> {
  id: string;
  intent: string;
  intentBehavior?: "collapse" | "keep-all";
  title: string;
  group: CommandActionGroup;
  keywords?: string[];
  shortcut?: string[];
  priority?: number;
  run: (args: CommandExecutionArgs<TContext, THelpers>) => void | Promise<void>;
  isRedundant?: (args: CommandExecutionArgs<TContext, THelpers>) => boolean;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export interface CommandContextDefinition<TContext, THelpers = unknown> {
  id: string;
  priority?: number;
  matches: (route: CommandRouteInfo) => boolean;
  resolve: (route: CommandRouteInfo) => TContext | null;
}

export interface CommandPlugin<
  TContext,
  THelpers = unknown,
  TAction extends CommandAction<TContext, THelpers> = CommandAction<TContext, THelpers>,
> {
  id: string;
  priority?: number;
  matches?: (args: CommandPluginExecutionArgs<TContext, THelpers>) => boolean;
  getActions: (args: CommandPluginExecutionArgs<TContext, THelpers>) => TAction[];
  adjustActions?: (
    args: CommandPluginExecutionArgs<TContext, THelpers> & {
      actions: TAction[];
    },
  ) => TAction[];
}

export type ResolvedCommandAction<
  TAction extends CommandAction<any, any> = CommandAction,
> = TAction & {
  contextId: string;
};

export interface CommandActionSection<
  TAction extends Pick<ResolvedCommandAction, "group"> = ResolvedCommandAction,
> {
  id: string;
  title: string;
  actions: TAction[];
}
