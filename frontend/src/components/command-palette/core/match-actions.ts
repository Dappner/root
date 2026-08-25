import type { CommandAction, ResolvedCommandAction } from "./types";

export interface MatchedCommandAction<TAction extends CommandAction<any, any>> {
  action: ResolvedCommandAction<TAction>;
  score: number;
}

export function matchActions<TAction extends CommandAction<any, any>>(
  actions: ResolvedCommandAction<TAction>[],
  query: string,
): MatchedCommandAction<TAction>[] {
  const normalizedQuery = normalizeQuery(query);

  if (!normalizedQuery.raw) {
    return actions.map((action, index) => ({
      action,
      score: (action.priority ?? 0) * 10 - index,
    }));
  }

  return actions
    .map((action, index) => ({
      action,
      score: scoreAction(action, normalizedQuery, index),
    }))
    .filter((item) => item.score > Number.NEGATIVE_INFINITY)
    .sort((left, right) => right.score - left.score);
}

function scoreAction<TAction extends CommandAction<any, any>>(
  action: ResolvedCommandAction<TAction>,
  query: ReturnType<typeof normalizeQuery>,
  index: number,
) {
  const shortcutScore = scoreShortcutMatch(action, query);
  const textScore = scoreTextMatch(action, query.raw);
  const bestScore = Math.max(shortcutScore, textScore);

  if (bestScore === Number.NEGATIVE_INFINITY) {
    return bestScore;
  }

  return bestScore + basePriorityScore(action, index);
}

function scoreShortcutMatch<TAction extends CommandAction<any, any>>(
  action: ResolvedCommandAction<TAction>,
  query: ReturnType<typeof normalizeQuery>,
) {
  if (!action.shortcut || action.shortcut.length === 0 || query.tokens.length === 0) {
    return Number.NEGATIVE_INFINITY;
  }

  const shortcutTokens = action.shortcut
    .map(normalizeToken)
    .filter((token): token is string => token !== null);
  const exactShortcut =
    shortcutTokens.length === query.tokens.length &&
    query.tokens.every((token, index) => shortcutTokens[index] === token);

  if (exactShortcut) {
    return 5_000;
  }

  const prefixShortcut = query.tokens.every(
    (token, index) => shortcutTokens[index]?.startsWith(token) ?? false,
  );

  if (!prefixShortcut) {
    return Number.NEGATIVE_INFINITY;
  }

  let score = 4_000 - query.tokens.length * 10;

  if (query.hasExplicitShortcutSpacing) {
    score += 700;
  } else if (query.tokens.length === 1 && query.tokens[0].length === 1) {
    score += 300;
  }

  return score;
}

function scoreTextMatch<TAction extends CommandAction<any, any>>(
  action: ResolvedCommandAction<TAction>,
  rawQuery: string,
) {
  const haystacks = [action.title, ...(action.keywords ?? [])]
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  const compactLabel = compact(action.title);
  const compactQuery = compact(rawQuery);
  const initials = getInitials(action.title);

  if (haystacks.some((value) => value === rawQuery)) {
    return 3_000;
  }

  if (haystacks.some((value) => value.startsWith(rawQuery))) {
    return 2_200;
  }

  if (haystacks.some((value) => value.includes(rawQuery))) {
    return 1_600;
  }

  if (compactQuery && compactLabel.startsWith(compactQuery)) {
    return 1_400;
  }

  if (compactQuery && initials.startsWith(compactQuery)) {
    return 1_300;
  }

  return Number.NEGATIVE_INFINITY;
}

function basePriorityScore<TAction extends CommandAction<any, any>>(
  action: ResolvedCommandAction<TAction>,
  index: number,
) {
  return (action.priority ?? 0) * 10 - index;
}

function normalizeQuery(query: string) {
  const raw = query.trim().toLowerCase();
  const hasExplicitShortcutSpacing = /\s/.test(query.trim());
  const tokens = query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map(normalizeToken)
    .filter((token): token is string => token !== null);

  return {
    raw,
    tokens,
    hasExplicitShortcutSpacing,
  };
}

function normalizeToken(value: string) {
  const normalized = value.trim().toLowerCase();
  return normalized || null;
}

function compact(value: string) {
  return value.toLowerCase().replace(/\s+/g, "");
}

function getInitials(value: string) {
  return value
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0] ?? "")
    .join("");
}
