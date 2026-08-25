import type { AppState } from "./app-state";

export type AppCommandContext =
  | { type: "default"; pathname: string | null }
  | { type: "library"; pathname: string | null }
  | {
      type: "source";
      pathname: string | null;
      sourceId: number;
      sectionId?: string;
    }
  | {
      type: "collection";
      pathname: string | null;
      collectionId: number;
    };

export function resolveActiveContexts(appState: AppState): AppCommandContext[] {
  const contexts: AppCommandContext[] = [
    { type: "default", pathname: appState.pathname },
  ];

  if (appState.pathname === "/library") {
    contexts.push({ type: "library", pathname: appState.pathname });
  }

  if (appState.sourceId !== undefined) {
    contexts.push({
      type: "source",
      pathname: appState.pathname,
      sourceId: appState.sourceId,
      sectionId: appState.currentSectionId,
    });
  }

  if (appState.collectionId !== undefined) {
    contexts.push({
      type: "collection",
      pathname: appState.pathname,
      collectionId: appState.collectionId,
    });
  }

  return contexts;
}
