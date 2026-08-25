"use client";

import { Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

import { closePicker, usePickerStore } from "./store";

interface SelectedPickerEntry {
  kind: "item";
  item: unknown;
}

interface ActionPickerEntry {
  kind: "action";
  action: {
    id: string;
  };
}

function isSelectedPickerEntry(value: unknown): value is SelectedPickerEntry {
  return Boolean(
    value &&
      typeof value === "object" &&
      "kind" in value &&
      value.kind === "item" &&
      "item" in value,
  );
}

function isActionPickerEntry(value: unknown): value is ActionPickerEntry {
  return Boolean(
    value &&
      typeof value === "object" &&
      "kind" in value &&
      value.kind === "action" &&
      "action" in value,
  );
}

export function PickerRenderer() {
  const {
    definition,
    title,
    items,
    open,
    hasParent,
    placeholder,
    emptyMessage,
    onResolve,
    onCancel,
  } = usePickerStore();

  const [query, setQuery] = useState("");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  const definitionRef = useRef(definition);
  const itemsRef = useRef(items);
  const onResolveRef = useRef(onResolve);
  const onCancelRef = useRef(onCancel);

  useEffect(() => {
    definitionRef.current = definition;
    itemsRef.current = items;
    onResolveRef.current = onResolve;
    onCancelRef.current = onCancel;
  }, [definition, items, onResolve, onCancel]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedKey(null);
    }
  }, [open]);

  const visibleItems = useMemo(() => {
    if (!definition) {
      return [];
    }

    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return items;
    }

    return items.filter((item) => {
      const label = definition.getLabel(item).toLowerCase();
      const keywords = (definition.getKeywords?.(item) ?? []).map((value) =>
        value.trim().toLowerCase(),
      );

      return [label, ...keywords].some((value) => value.includes(normalizedQuery));
    });
  }, [definition, items, query]);

  useEffect(() => {
    if (visibleItems.length === 0 || !definition) {
      setSelectedKey(null);
      return;
    }

    const stillSelected = selectedKey
      ? visibleItems.some((item) => definition.getKey(item) === selectedKey)
      : false;

    if (!stillSelected) {
      setSelectedKey(definition.getKey(visibleItems[0]));
    }
  }, [definition, selectedKey, visibleItems]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: 0 });
  }, [query]);

  if (!definition || !open) {
    return null;
  }

  const cancel = () => {
    onCancelRef.current?.();
    closePicker();
  };

  const select = (item: unknown) => {
    if (isSelectedPickerEntry(item)) {
      onResolveRef.current?.({ kind: "selected", item: item.item });
    } else if (isActionPickerEntry(item)) {
      onResolveRef.current?.({ kind: "action", actionId: item.action.id });
    }

    closePicker();
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      cancel();
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      moveSelection(1);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      moveSelection(-1);
      return;
    }

    if (event.key === "Enter") {
      const selectedItem =
        visibleItems.find((item) => definition.getKey(item) === selectedKey) ??
        visibleItems[0];

      if (!selectedItem) {
        return;
      }

      event.preventDefault();
      select(selectedItem);
      return;
    }

    if (event.key === "Backspace" && query === "" && hasParent) {
      event.preventDefault();
      cancel();
    }
  };

  const moveSelection = (direction: 1 | -1) => {
    if (visibleItems.length === 0) {
      setSelectedKey(null);
      return;
    }

    const currentIndex = selectedKey
      ? visibleItems.findIndex((item) => definition.getKey(item) === selectedKey)
      : -1;
    const nextIndex =
      currentIndex === -1
        ? 0
        : (currentIndex + direction + visibleItems.length) % visibleItems.length;

    setSelectedKey(definition.getKey(visibleItems[nextIndex]));
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="top-[20%] flex max-h-[70vh] max-w-xl translate-y-0 flex-col gap-0 overflow-hidden border border-border bg-popover p-0 text-popover-foreground shadow-2xl"
      >
        <DialogTitle className="sr-only">{title}</DialogTitle>

        <div className="flex items-center gap-2 border-b border-border bg-accent/50 px-4 py-2 text-sm">
          {hasParent && <span className="text-muted-foreground">←</span>}
          <span className="font-medium">{title}</span>
        </div>

        <div className="flex items-center border-b border-border bg-background px-4">
          <Search className="mr-2 h-4 w-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="h-auto w-full border-0 bg-transparent py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground"
            autoFocus
          />
        </div>

        <div
          ref={listRef}
          className="min-h-0 flex-1 overflow-y-auto p-2"
          role="listbox"
          aria-label={title}
        >
          {visibleItems.length === 0 && (
            <div className="py-6 text-center text-sm text-muted-foreground">
              {emptyMessage}
            </div>
          )}

          {visibleItems.map((item) => {
            const key = definition.getKey(item);
            const selected = selectedKey === key;

            return (
              <button
                type="button"
                key={key}
                role="option"
                aria-selected={selected}
                onClick={() => select(item)}
                onMouseEnter={() => setSelectedKey(key)}
                className={cn(
                  "flex w-full rounded-md px-2 py-2 text-left text-sm",
                  selected
                    ? "bg-accent text-accent-foreground"
                    : "text-foreground",
                )}
              >
                {definition.renderItem ? (
                  definition.renderItem({ item, selected })
                ) : (
                  <span>{definition.getLabel(item)}</span>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-4 border-t border-border px-4 py-2 text-xs text-muted-foreground">
          {hasParent && (
            <span className="flex items-center gap-1">
              <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                ⌫
              </kbd>
              Back
            </span>
          )}
          <span className="flex items-center gap-1">
            <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
              ↑↓
            </kbd>
            Navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
              ↵
            </kbd>
            Select
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
              ESC
            </kbd>
            Close
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
