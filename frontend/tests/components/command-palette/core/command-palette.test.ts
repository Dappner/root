import test from "node:test";
import assert from "node:assert/strict";

import type {
  CommandAction,
  CommandContextDefinition,
  CommandPlugin,
  CommandRouteInfo,
  ResolvedCommandAction,
} from "@/components/command-palette/types";
import {
  advanceGlobalShortcut,
  createEmptyGlobalShortcutState,
} from "@/components/command-palette/core/shortcuts";
import { matchActions } from "@/components/command-palette/core/match-actions";
import {
  resolveCommandContexts,
  resolveCommandPlugins,
} from "@/components/command-palette/core/resolve-actions";

interface TestContext {
  type: "default" | "library" | "source";
  pathname: string | null;
}

type TestAction = CommandAction<TestContext, Record<string, never>>;

test("resolveCommandContexts layers matching contexts by priority", () => {
  const route: CommandRouteInfo = {
    pathname: "/library/123",
    params: { itemId: "123" },
  };

  const defaults: CommandContextDefinition<TestContext>[] = [
    {
      id: "default",
      priority: 0,
      matches: () => true,
      resolve: ({ pathname }: CommandRouteInfo) => ({ type: "default", pathname }),
    },
  ];

  const contexts: CommandContextDefinition<TestContext>[] = [
    {
      id: "library",
      priority: 10,
      matches: ({ pathname }: CommandRouteInfo) => pathname === "/library/123",
      resolve: ({ pathname }: CommandRouteInfo) => ({ type: "library", pathname }),
    },
    {
      id: "source",
      priority: 20,
      matches: ({ params }: CommandRouteInfo) => typeof params?.itemId === "string",
      resolve: ({ pathname }: CommandRouteInfo) => ({ type: "source", pathname }),
    },
  ];

  const resolved = resolveCommandContexts({
    route,
    defaults,
    contexts,
  });

  assert.deepEqual(
    resolved.map(({ definition }) => definition.id),
    ["source", "library", "default"],
  );
});

test("plugin precedence collapses duplicate intents to the higher-priority action", () => {
  const contexts: Array<{
    definition: CommandContextDefinition<TestContext>;
    context: TestContext;
  }> = [
    {
      definition: {
        id: "default",
        priority: 0,
        matches: () => true,
        resolve: () => ({ type: "default", pathname: "/" }),
      },
      context: { type: "default", pathname: "/" },
    },
    {
      definition: {
        id: "source",
        priority: 20,
        matches: () => true,
        resolve: () => ({ type: "source", pathname: "/library/1" }),
      },
      context: { type: "source", pathname: "/library/1" },
    },
  ];

  const plugins: CommandPlugin<TestContext, Record<string, never>, TestAction>[] = [
    {
      id: "default-actions",
      priority: 0,
      getActions: () => [
        {
          id: "global-create-citation",
          intent: "create-citation",
          title: "Create Citation",
          group: "actions",
          priority: 10,
          run: () => {},
        },
      ],
    },
    {
      id: "source-actions",
      priority: 10,
      matches: ({ contexts: activeContexts }) =>
        activeContexts.some((context: TestContext) => context.type === "source"),
      getActions: () => [
        {
          id: "source-create-citation",
          intent: "create-citation",
          title: "Add Citation",
          group: "context",
          priority: 100,
          run: () => {},
        },
      ],
    },
  ];

  const resolved = resolveCommandPlugins({
    contexts,
    helpers: {},
    plugins,
  });

  assert.equal(resolved.length, 1);
  assert.equal(resolved[0]?.id, "source-create-citation");
});

test("plugin adjustments can rebalance existing actions by intent", () => {
  const contexts: Array<{
    definition: CommandContextDefinition<TestContext>;
    context: TestContext;
  }> = [
    {
      definition: {
        id: "default",
        priority: 0,
        matches: () => true,
        resolve: () => ({ type: "default", pathname: "/library" }),
      },
      context: { type: "default", pathname: "/library" },
    },
    {
      definition: {
        id: "library",
        priority: 10,
        matches: () => true,
        resolve: () => ({ type: "library", pathname: "/library" }),
      },
      context: { type: "library", pathname: "/library" },
    },
  ];

  const plugins: CommandPlugin<TestContext, Record<string, never>, TestAction>[] = [
    {
      id: "default-actions",
      getActions: () => [
        {
          id: "create-source",
          intent: "create-source",
          title: "Create Source",
          group: "actions",
          priority: 10,
          run: () => {},
        },
        {
          id: "create-citation",
          intent: "create-citation",
          title: "Create Citation",
          group: "actions",
          priority: 20,
          run: () => {},
        },
      ],
    },
    {
      id: "library-priority",
      priority: 100,
      matches: ({ contexts: activeContexts }) =>
        activeContexts.some((context: TestContext) => context.type === "library"),
      getActions: () => [],
      adjustActions: ({ actions }) =>
        actions.map((action: TestAction) =>
          action.intent === "create-source"
            ? { ...action, priority: 200 }
            : action,
        ),
    },
  ];

  const resolved = resolveCommandPlugins({
    contexts,
    helpers: {},
    plugins,
  });

  assert.equal(resolved[0]?.id, "create-source");
});

test("matchActions strongly favors shortcut prefixes like 'g '", () => {
  const actions: ResolvedCommandAction<TestAction>[] = [
    {
      id: "go-ask",
      contextId: "navigation",
      intent: "go-ask",
      title: "Go to Ask",
      group: "navigation",
      shortcut: ["g", "a"],
      priority: 10,
      run: () => {},
    },
    {
      id: "create-source",
      contextId: "actions",
      intent: "create-source",
      title: "Create Source",
      group: "actions",
      shortcut: ["c", "s"],
      priority: 10,
      run: () => {},
    },
  ];

  const matched = matchActions(actions, "g ");

  assert.equal(matched[0]?.action.id, "go-ask");
});

test("matchActions exact shortcut beats text matching", () => {
  const actions: ResolvedCommandAction<TestAction>[] = [
    {
      id: "go-admin",
      contextId: "navigation",
      intent: "go-admin",
      title: "Go to Admin",
      group: "navigation",
      shortcut: ["g", "d"],
      priority: 10,
      run: () => {},
    },
    {
      id: "go-ask",
      contextId: "navigation",
      intent: "go-ask",
      title: "Go to Ask",
      group: "navigation",
      shortcut: ["g", "a"],
      priority: 10,
      run: () => {},
    },
  ];

  const matched = matchActions(actions, "g a");

  assert.equal(matched[0]?.action.id, "go-ask");
});

test("advanceGlobalShortcut in leader mode requires the leader key first", () => {
  const actions: ResolvedCommandAction<TestAction>[] = [
    {
      id: "go-ask",
      contextId: "navigation",
      intent: "go-ask",
      title: "Go to Ask",
      group: "navigation",
      shortcut: ["g", "a"],
      priority: 10,
      run: () => {},
    },
  ];

  const ignored = advanceGlobalShortcut(
    actions,
    "g",
    createEmptyGlobalShortcutState(),
    { mode: "leader", leaderKey: " " },
  );
  assert.equal(ignored.action, null);
  assert.equal(ignored.consumed, false);

  const armed = advanceGlobalShortcut(
    actions,
    " ",
    createEmptyGlobalShortcutState(),
    { mode: "leader", leaderKey: " " },
  );
  assert.equal(armed.action, null);
  assert.equal(armed.consumed, true);
  assert.equal(armed.state.armed, true);

  const pending = advanceGlobalShortcut(actions, "g", armed.state, {
    mode: "leader",
    leaderKey: " ",
  });
  assert.equal(pending.action, null);
  assert.equal(pending.consumed, true);
  assert.equal(pending.state.armed, true);

  const matched = advanceGlobalShortcut(actions, "a", pending.state, {
    mode: "leader",
    leaderKey: " ",
  });
  assert.equal(matched.action?.id, "go-ask");
  assert.equal(matched.consumed, true);
  assert.equal(matched.state.armed, false);
});

test("advanceGlobalShortcut in disabled mode never captures global combos", () => {
  const actions: ResolvedCommandAction<TestAction>[] = [
    {
      id: "create-citation",
      contextId: "actions",
      intent: "create-citation",
      title: "Create Citation",
      group: "actions",
      shortcut: ["c", "c"],
      priority: 10,
      run: () => {},
    },
  ];

  const result = advanceGlobalShortcut(
    actions,
    "c",
    createEmptyGlobalShortcutState(),
    { mode: "disabled", leaderKey: " " },
  );

  assert.equal(result.action, null);
  assert.equal(result.consumed, false);
  assert.deepEqual(result.state, createEmptyGlobalShortcutState());
});
