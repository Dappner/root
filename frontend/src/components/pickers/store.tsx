"use client";

import type { ReactNode } from "react";
import { create } from "zustand";

export interface PickerRenderItemArgs<TItem> {
  item: TItem;
  selected: boolean;
}

export interface SimplePickerOption<TValue> {
  label: string;
  value: TValue;
  description?: string;
  keywords?: string[];
  render?: (args: { selected: boolean }) => ReactNode;
}

export interface PickerAction<TAction extends string> {
  id: TAction;
  label: string;
  description?: string;
  keywords?: string[];
  render?: (args: { selected: boolean }) => ReactNode;
}

export interface PickerDefinition<TItem> {
  id: string;
  getKey: (item: TItem) => string;
  getLabel: (item: TItem) => string;
  getKeywords?: (item: TItem) => string[];
  renderItem?: (args: PickerRenderItemArgs<TItem>) => ReactNode;
}

export interface OpenPickerOptions<TItem, TAction extends string = never> {
  title: string;
  items: TItem[];
  actions?: PickerAction<TAction>[];
  placeholder?: string;
  emptyMessage?: string;
  hasParent?: boolean;
}

export type PickerResult<TItem, TAction extends string = never> =
  | { kind: "selected"; item: TItem }
  | { kind: "action"; actionId: TAction }
  | { kind: "back" }
  | { kind: "cancel" };

interface SimplePickerItem<TValue> {
  id: string;
  option: SimplePickerOption<TValue>;
}

interface PickerEntryAction<TAction extends string> {
  kind: "action";
  action: PickerAction<TAction>;
}

interface PickerEntryItem<TItem> {
  kind: "item";
  item: TItem;
}

type PickerEntry<TItem, TAction extends string> =
  | PickerEntryItem<TItem>
  | PickerEntryAction<TAction>;

interface PickerState {
  definition: PickerDefinition<any> | null;
  title: string;
  items: any[];
  open: boolean;
  hasParent: boolean;
  placeholder: string;
  emptyMessage: string;
  onResolve?: (value: unknown) => void;
  onCancel?: () => void;
}

const DEFAULT_PLACEHOLDER = "Search...";
const DEFAULT_EMPTY_MESSAGE = "No results found.";

export const usePickerStore = create<PickerState>(() => ({
  definition: null,
  title: "",
  items: [],
  open: false,
  hasParent: false,
  placeholder: DEFAULT_PLACEHOLDER,
  emptyMessage: DEFAULT_EMPTY_MESSAGE,
}));

export function createPicker<TItem>(definition: PickerDefinition<TItem>) {
  return definition;
}

function createPickerEntryDefinition<TItem, TAction extends string>(
  definition: PickerDefinition<TItem>,
): PickerDefinition<PickerEntry<TItem, TAction>> {
  return {
    id: `${definition.id}-entry`,
    getKey: (entry) =>
      entry.kind === "item"
        ? `item:${definition.getKey(entry.item)}`
        : `action:${entry.action.id}`,
    getLabel: (entry) =>
      entry.kind === "item" ? definition.getLabel(entry.item) : entry.action.label,
    getKeywords: (entry) => {
      if (entry.kind === "item") {
        return definition.getKeywords?.(entry.item) ?? [];
      }

      return [
        entry.action.label,
        entry.action.description,
        ...(entry.action.keywords ?? []),
      ].filter((value): value is string => Boolean(value));
    },
    renderItem: ({ item, selected }) => {
      if (item.kind === "item") {
        return definition.renderItem
          ? definition.renderItem({ item: item.item, selected })
          : definition.getLabel(item.item);
      }

      return item.action.render ? (
        item.action.render({ selected })
      ) : item.action.description ? (
        <div className="flex flex-col gap-0.5">
          <span>{item.action.label}</span>
          <span className="text-xs text-muted-foreground">{item.action.description}</span>
        </div>
      ) : (
        item.action.label
      );
    },
  };
}

export function openPicker<TItem, TAction extends string = never>(
  definition: PickerDefinition<TItem>,
  options: OpenPickerOptions<TItem, TAction> & {
    onResolve?: (value: PickerResult<TItem, TAction>) => void;
    onCancel?: () => void;
  },
) {
  const runtimeDefinition = createPickerEntryDefinition<TItem, TAction>(definition);
  const runtimeItems: PickerEntry<TItem, TAction>[] = [
    ...(options.actions ?? []).map((action) => ({ kind: "action", action }) as const),
    ...options.items.map((item) => ({ kind: "item", item }) as const),
  ];

  usePickerStore.setState({
    definition: runtimeDefinition as PickerDefinition<any>,
    title: options.title,
    items: runtimeItems as any[],
    open: true,
    hasParent: options.hasParent ?? false,
    placeholder: options.placeholder ?? DEFAULT_PLACEHOLDER,
    emptyMessage: options.emptyMessage ?? DEFAULT_EMPTY_MESSAGE,
    onResolve: options.onResolve as ((value: unknown) => void) | undefined,
    onCancel: options.onCancel,
  });
}

export function closePicker() {
  usePickerStore.setState({
    definition: null,
    title: "",
    items: [],
    open: false,
    hasParent: false,
    placeholder: DEFAULT_PLACEHOLDER,
    emptyMessage: DEFAULT_EMPTY_MESSAGE,
    onResolve: undefined,
    onCancel: undefined,
  });
}

export function openPickerResultAsync<TItem, TAction extends string = never>(
  definition: PickerDefinition<TItem>,
  options: OpenPickerOptions<TItem, TAction>,
): Promise<PickerResult<TItem, TAction>> {
  return new Promise((resolve) => {
    let settled = false;

    openPicker(definition, {
      ...options,
      onResolve: (value) => {
        if (settled) {
          return;
        }
        settled = true;
        resolve(value);
      },
      onCancel: () => {
        if (settled) {
          return;
        }
        settled = true;
        resolve({ kind: options.hasParent ? "back" : "cancel" });
      },
    });
  });
}

const simplePicker = createPicker<SimplePickerItem<unknown>>({
  id: "simple-picker",
  getKey: (item) => item.id,
  getLabel: (item) => item.option.label,
  getKeywords: (item) => [
    item.option.label,
    item.option.description,
    ...(item.option.keywords ?? []),
  ].filter((value): value is string => Boolean(value)),
  renderItem: ({ item, selected }) =>
    item.option.render ? (
      item.option.render({ selected })
    ) : item.option.description ? (
      <div className="flex flex-col gap-0.5">
        <span>{item.option.label}</span>
        <span className="text-xs text-muted-foreground">{item.option.description}</span>
      </div>
    ) : (
      item.option.label
    ),
});

export function openSimplePickerResultAsync<TValue, TAction extends string = never>(
  options: OpenPickerOptions<SimplePickerOption<TValue>, TAction>,
): Promise<PickerResult<TValue, TAction>> {
  const items = options.items.map((option, index) => ({
    id: `option:${index}`,
    option,
  }));

  return openPickerResultAsync(simplePicker as PickerDefinition<SimplePickerItem<TValue>>, {
    ...options,
    items,
  }).then((result) => {
    if (result.kind !== "selected") {
      return result;
    }

    return {
      kind: "selected",
      item: result.item.option.value,
    } satisfies PickerResult<TValue, TAction>;
  });
}

export function usePicker() {
  return { openPicker, closePicker } as const;
}
