import type { CommandAction, ResolvedCommandAction } from "./types";

export const DEFAULT_SHORTCUT_SEQUENCE_TIMEOUT_MS = 500;

export type GlobalShortcutMode = "disabled" | "leader" | "direct";

export interface ShortcutMatchState {
  keys: string[];
  lastKeyAt: number;
}

export interface GlobalShortcutState {
  armed: boolean;
  sequence: ShortcutMatchState;
}

export interface ShortcutMatchResult<TAction extends CommandAction<any, any>> {
  action: ResolvedCommandAction<TAction> | null;
  state: ShortcutMatchState;
}

export interface GlobalShortcutAdvanceResult<TAction extends CommandAction<any, any>> {
  action: ResolvedCommandAction<TAction> | null;
  state: GlobalShortcutState;
  consumed: boolean;
}

export interface GlobalShortcutConfig {
  mode: GlobalShortcutMode;
  leaderKey?: string;
  timeoutMs?: number;
}

export function createEmptyShortcutState(): ShortcutMatchState {
  return {
    keys: [],
    lastKeyAt: 0,
  };
}

export function createEmptyGlobalShortcutState(): GlobalShortcutState {
  return {
    armed: false,
    sequence: createEmptyShortcutState(),
  };
}

export function advanceGlobalShortcut<TAction extends CommandAction<any, any>>(
  actions: ResolvedCommandAction<TAction>[],
  key: string,
  previousState: GlobalShortcutState,
  config: GlobalShortcutConfig,
  now = Date.now(),
): GlobalShortcutAdvanceResult<TAction> {
  if (config.mode === "disabled") {
    return {
      action: null,
      state: createEmptyGlobalShortcutState(),
      consumed: false,
    };
  }

  const normalizedKey = normalizeShortcutKey(key);
  if (!normalizedKey) {
    return {
      action: null,
      state: createEmptyGlobalShortcutState(),
      consumed: false,
    };
  }

  if (normalizedKey === "escape") {
    return {
      action: null,
      state: createEmptyGlobalShortcutState(),
      consumed: previousState.armed || previousState.sequence.keys.length > 0,
    };
  }

  if (config.mode === "leader") {
    const leaderKey = normalizeShortcutKey(config.leaderKey ?? " ");

    if (!previousState.armed) {
      if (leaderKey && normalizedKey === leaderKey) {
        return {
          action: null,
          state: {
            armed: true,
            sequence: createEmptyShortcutState(),
          },
          consumed: true,
        };
      }

      return {
        action: null,
        state: createEmptyGlobalShortcutState(),
        consumed: false,
      };
    }
  }

  const timeoutMs = config.timeoutMs ?? DEFAULT_SHORTCUT_SEQUENCE_TIMEOUT_MS;
  const match = matchShortcut(actions, key, previousState.sequence, now, timeoutMs);

  if (match.action) {
    return {
      action: match.action,
      state: createEmptyGlobalShortcutState(),
      consumed: true,
    };
  }

  const hasPendingSequence = match.state.keys.length > 0;

  return {
    action: null,
    state:
      config.mode === "leader"
        ? {
            armed: hasPendingSequence,
            sequence: match.state,
          }
        : {
            armed: false,
            sequence: match.state,
          },
    consumed: config.mode === "leader" ? previousState.armed : hasPendingSequence,
  };
}

export function matchShortcut<TAction extends CommandAction<any, any>>(
  actions: ResolvedCommandAction<TAction>[],
  key: string,
  previousState: ShortcutMatchState,
  now = Date.now(),
  timeoutMs = DEFAULT_SHORTCUT_SEQUENCE_TIMEOUT_MS,
): ShortcutMatchResult<TAction> {
  const normalizedKey = normalizeShortcutKey(key);
  if (!normalizedKey) {
    return {
      action: null,
      state: createEmptyShortcutState(),
    };
  }

  const nextKeys =
    now - previousState.lastKeyAt > timeoutMs
      ? [normalizedKey]
      : [...previousState.keys, normalizedKey];

  const exactMatch = actions.find((action) => shortcutEquals(action.shortcut, nextKeys));
  if (exactMatch) {
    return {
      action: exactMatch,
      state: createEmptyShortcutState(),
    };
  }

  const hasPrefixMatch = actions.some((action) => shortcutStartsWith(action.shortcut, nextKeys));
  if (hasPrefixMatch) {
    return {
      action: null,
      state: {
        keys: nextKeys,
        lastKeyAt: now,
      },
    };
  }

  const restartMatch = actions.find((action) => shortcutEquals(action.shortcut, [normalizedKey]));
  if (restartMatch) {
    return {
      action: restartMatch,
      state: createEmptyShortcutState(),
    };
  }

  const restartPrefix = actions.some((action) => shortcutStartsWith(action.shortcut, [normalizedKey]));
  if (restartPrefix) {
    return {
      action: null,
      state: {
        keys: [normalizedKey],
        lastKeyAt: now,
      },
    };
  }

  return {
    action: null,
    state: createEmptyShortcutState(),
  };
}

function shortcutEquals(shortcut: string[] | undefined, keys: string[]) {
  if (!shortcut || shortcut.length !== keys.length) {
    return false;
  }

  return shortcut.every((part, index) => normalizeShortcutKey(part) === keys[index]);
}

function shortcutStartsWith(shortcut: string[] | undefined, keys: string[]) {
  if (!shortcut || shortcut.length < keys.length) {
    return false;
  }

  return keys.every((part, index) => normalizeShortcutKey(shortcut[index]) === part);
}

function normalizeShortcutKey(value: string) {
  if (value === " ") {
    return "space";
  }

  const trimmed = value.trim().toLowerCase();

  if (!trimmed) {
    return null;
  }

  if (trimmed === "spacebar") {
    return "space";
  }

  return trimmed;
}
