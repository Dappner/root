"use client";

import { useEffect, useRef, useState } from "react";
import {
  buildNavigableItems,
  type NavigableItem,
  type CommandLike,
  type CommandSectionLike,
} from "./build-navigable-items";

interface MatchableCommand extends CommandLike {
  label: string;
  description?: string;
  keywords?: string[];
  shortcut?: string[];
}

interface UseCommandPaletteControllerArgs<TCommand extends MatchableCommand> {
  commandSections: CommandSectionLike<TCommand>[];
  isOpen: boolean;
  leaderKey?: string;
  onClose: () => void;
  onBackspaceAtEmpty?: () => void;
}

export function useCommandPaletteController<TCommand extends MatchableCommand>({
  commandSections,
  isOpen,
  leaderKey,
  onClose,
  onBackspaceAtEmpty,
}: UseCommandPaletteControllerArgs<TCommand>) {
  const [inputValue, setInputValue] = useState("");
  const [selectedItemIdState, setSelectedItemIdState] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setInputValue("");
      setSelectedItemIdState(null);
    }
  }, [isOpen]);

  const visibleCommandSections = rankCommandSections(commandSections, inputValue, leaderKey);
  const items = buildNavigableItems({
    visibleCommandSections,
  });
  const selectedItemId = getValidSelectedItemId(selectedItemIdState, items);

  const handleItemSelect = (item: NavigableItem<TCommand>) => {
    item.command.action();
  };

  const handleInputKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    handlers?: {
      onCommandSelect?: (action: () => void | Promise<void>) => void;
    },
  ) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      moveSelection(1, items, selectedItemId, setSelectedItemIdState);
      return;
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      moveSelection(-1, items, selectedItemId, setSelectedItemIdState);
      return;
    }

    if (e.key === "Enter") {
      const selectedItem = items.find((item) => item.id === selectedItemId) ?? items[0];
      if (!selectedItem) {
        return;
      }

      e.preventDefault();

      if (handlers?.onCommandSelect) {
        handlers.onCommandSelect(selectedItem.command.action);
        return;
      }

      selectedItem.command.action();
      return;
    }

    if (e.key === "Backspace" && inputValue === "") {
      e.preventDefault();
      onBackspaceAtEmpty?.();
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setInputValue("");
      setSelectedItemIdState(null);
      onClose();
    }
  };

  return {
    inputValue,
    setInputValue,
    visibleCommandSections,
    navigableItems: items,
    selectedItemId,
    setSelectedItemId: setSelectedItemIdState,
    listRef,
    handleInputKeyDown,
    handleOpenChange,
    handleItemSelect,
  };
}

function rankCommandSections<TCommand extends MatchableCommand>(
  sections: CommandSectionLike<TCommand>[],
  query: string,
  leaderKey?: string,
) {
  if (!query.trim()) {
    return sections.filter((section) => section.commands.length > 0);
  }

  const shortcutQuery = getShortcutModeQuery(query, leaderKey);
  const isShortcutMode = shortcutQuery !== null;
  const searchableQuery = shortcutQuery ?? query;
  const normalizedQuery = searchableQuery.trim().toLowerCase();
  const queryTokens = getQueryTokens(searchableQuery, isShortcutMode);
  const hasExplicitShortcutSpacing = /\s/.test(searchableQuery.trim());

  return sections
    .map((section) => {
      const commands = section.commands
        .map((command, index) => ({
          command,
          score: scoreCommand(
            command,
            normalizedQuery,
            queryTokens,
            hasExplicitShortcutSpacing,
            index,
            isShortcutMode,
          ),
        }))
        .filter((item) => item.score > Number.NEGATIVE_INFINITY)
        .sort((left, right) => right.score - left.score)
        .map((item) => item.command);

      if (commands.length === 0) {
        return null;
      }

      return {
        ...section,
        commands,
      };
    })
    .filter((section): section is CommandSectionLike<TCommand> => section !== null);
}

function scoreCommand<TCommand extends MatchableCommand>(
  command: TCommand,
  normalizedQuery: string,
  queryTokens: string[],
  hasExplicitShortcutSpacing: boolean,
  index: number,
  isShortcutMode: boolean,
) {
  const shortcutScore = scoreShortcut(command.shortcut, queryTokens, hasExplicitShortcutSpacing);
  const textScore = isShortcutMode
    ? Number.NEGATIVE_INFINITY
    : scoreText(command, normalizedQuery);
  const bestScore = Math.max(shortcutScore, textScore);

  if (bestScore === Number.NEGATIVE_INFINITY) {
    return bestScore;
  }

  return bestScore - index;
}

function getShortcutModeQuery(query: string, leaderKey?: string) {
  if (!leaderKey) return null;

  const trimmedStart = query.trimStart();
  if (!trimmedStart.startsWith(leaderKey)) return null;

  return trimmedStart.slice(leaderKey.length);
}

function getQueryTokens(query: string, isShortcutMode: boolean) {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return [];

  if (isShortcutMode && !/\s/.test(trimmed)) {
    return [...trimmed];
  }

  return trimmed.split(/\s+/).filter(Boolean);
}

function scoreShortcut(
  shortcut: string[] | undefined,
  queryTokens: string[],
  hasExplicitShortcutSpacing: boolean,
) {
  if (!shortcut || shortcut.length === 0 || queryTokens.length === 0) {
    return Number.NEGATIVE_INFINITY;
  }

  const shortcutTokens = shortcut.map((token) => token.trim().toLowerCase());
  const exactShortcut =
    shortcutTokens.length === queryTokens.length &&
    queryTokens.every((token, index) => shortcutTokens[index] === token);

  if (exactShortcut) {
    return 5_000;
  }

  const prefixShortcut = queryTokens.every(
    (token, index) => shortcutTokens[index]?.startsWith(token) ?? false,
  );

  if (!prefixShortcut) {
    return Number.NEGATIVE_INFINITY;
  }

  let score = 4_000 - queryTokens.length * 10;

  if (hasExplicitShortcutSpacing) {
    score += 700;
  } else if (queryTokens.length === 1 && queryTokens[0]?.length === 1) {
    score += 300;
  }

  return score;
}

function scoreText<TCommand extends MatchableCommand>(command: TCommand, normalizedQuery: string) {
  const haystacks = [command.label, command.description, ...(command.keywords ?? [])]
    .filter(Boolean)
    .map((value) => value!.trim().toLowerCase());

  const compactLabel = compact(command.label);
  const compactQuery = compact(normalizedQuery);
  const initials = getInitials(command.label);

  if (haystacks.some((value) => value === normalizedQuery)) {
    return 3_000;
  }

  if (haystacks.some((value) => value.startsWith(normalizedQuery))) {
    return 2_200;
  }

  if (haystacks.some((value) => value.includes(normalizedQuery))) {
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

function getValidSelectedItemId(
  selectedItemId: string | null,
  items: Array<{ id: string }>,
) {
  if (items.length === 0) return null;
  if (selectedItemId && items.some((item) => item.id === selectedItemId)) {
    return selectedItemId;
  }

  return items[0]?.id ?? null;
}

function moveSelection(
  direction: 1 | -1,
  items: Array<{ id: string }>,
  selectedItemId: string | null,
  setSelectedItemId: (value: string | null) => void,
) {
  if (items.length === 0) {
    setSelectedItemId(null);
    return;
  }

  const currentIndex = selectedItemId
    ? items.findIndex((item) => item.id === selectedItemId)
    : -1;
  const nextIndex =
    currentIndex === -1
      ? 0
      : (currentIndex + direction + items.length) % items.length;

  setSelectedItemId(items[nextIndex]?.id ?? null);
}
