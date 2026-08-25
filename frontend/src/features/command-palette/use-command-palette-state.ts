"use client";

import { useMemo } from "react";
import { useAppState } from "./app/app-state";
import { resolveActiveContexts } from "./app/contexts";
import { resolveCommandState } from "./app/resolve-command-state";
import { useNavigationPlugin } from "./app/plugins/use-navigation-plugin";
import { useGlobalActionsPlugin } from "./app/plugins/use-global-actions-plugin";
import { useSourcePlugin } from "./app/plugins/use-source-plugin";
import { useCollectionPlugin } from "./app/plugins/use-collection-plugin";
import { usePreferencesPlugin } from "./app/plugins/use-preferences-plugin";

export function useCommandPaletteState(includeContextualActions = true) {
  const appState = useAppState();
  const contexts = useMemo(
    () => resolveActiveContexts(appState),
    [appState],
  );

  const navigationActions = useNavigationPlugin(appState);
  const globalActions = useGlobalActionsPlugin(appState);
  const sourceActions = useSourcePlugin(appState);
  const collectionActions = useCollectionPlugin(appState);
  const preferencesActions = usePreferencesPlugin();

  const allActions = useMemo(() => {
    if (!includeContextualActions) {
      return [...navigationActions, ...globalActions, ...preferencesActions];
    }
    return [
      ...navigationActions,
      ...globalActions,
      ...sourceActions,
      ...collectionActions,
      ...preferencesActions,
    ];
  }, [
    includeContextualActions,
    navigationActions,
    globalActions,
    sourceActions,
    collectionActions,
    preferencesActions,
  ]);

  const resolved = useMemo(
    () => resolveCommandState(contexts, allActions),
    [contexts, allActions],
  );

  return {
    appState,
    ...resolved,
  };
}
