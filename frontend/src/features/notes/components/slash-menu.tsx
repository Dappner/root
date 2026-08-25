"use client";

import * as React from "react";
import { forwardRef, useImperativeHandle, useState } from "react";
import { ReactRenderer } from "@tiptap/react";
import type { Editor, Range } from "@tiptap/core";
import type { SuggestionOptions } from "@tiptap/suggestion";
import tippy, { type Instance as TippyInstance } from "tippy.js";

// ---------------------------------------------------------------------------
// Slash item definitions
// ---------------------------------------------------------------------------

interface SlashItem {
  id: string;
  label: string;
  group: string;
  shortcut: string | null;
}

const SLASH_ITEMS: SlashItem[] = [
  { id: "h1", label: "Heading 1", group: "Text", shortcut: "#" },
  { id: "h2", label: "Heading 2", group: "Text", shortcut: "##" },
  { id: "h3", label: "Heading 3", group: "Text", shortcut: "###" },
  { id: "divider", label: "Divider", group: "Text", shortcut: "---" },
  { id: "citation", label: "Citation", group: "Reference", shortcut: null },
];

// ---------------------------------------------------------------------------
// Slash menu popup component
// ---------------------------------------------------------------------------

interface SlashMenuProps {
  items: SlashItem[];
  command: (item: SlashItem) => void;
}

interface SlashMenuHandle {
  onKeyDown: (event: KeyboardEvent) => boolean;
}

const SlashMenuComponent = forwardRef<SlashMenuHandle, SlashMenuProps>(
  ({ items, command }, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0);

    useImperativeHandle(ref, () => ({
      onKeyDown({ key }: KeyboardEvent): boolean {
        if (key === "ArrowUp") {
          setSelectedIndex((i) => (i - 1 + items.length) % items.length);
          return true;
        }
        if (key === "ArrowDown") {
          setSelectedIndex((i) => (i + 1) % items.length);
          return true;
        }
        if (key === "Enter") {
          const idx = selectedIndex < items.length ? selectedIndex : 0;
          const item = items[idx];
          if (item) command(item);
          return true;
        }
        return false;
      },
    }));

    if (items.length === 0) return null;

    // Clamp selected index to valid range
    const safeIndex = selectedIndex < items.length ? selectedIndex : 0;

    // Group items
    const groups: Map<string, SlashItem[]> = new Map();
    for (const item of items) {
      const group = groups.get(item.group) ?? [];
      group.push(item);
      groups.set(item.group, group);
    }

    return (
      <div className="z-50 min-w-[200px] overflow-hidden rounded-md border border-border bg-popover shadow-md">
        {[...groups.entries()].map(([group, groupItems]) => (
          <div key={group}>
            <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
              {group}
            </div>
            {groupItems.map((item) => {
              const flatIndex = items.indexOf(item);
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`flex w-full items-center justify-between gap-3 px-3 py-1.5 text-left text-sm transition-colors hover:bg-muted/60 ${
                    flatIndex === safeIndex ? "bg-muted/60" : ""
                  }`}
                  onClick={() => command(item)}
                  onMouseEnter={() => setSelectedIndex(flatIndex)}
                >
                  <span>{item.label}</span>
                  {item.shortcut && (
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {item.shortcut}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    );
  },
);
SlashMenuComponent.displayName = "SlashMenuComponent";

// ---------------------------------------------------------------------------
// Suggestion config factory
// ---------------------------------------------------------------------------

export function buildSlashSuggestion(
  onOpenCitationPicker: () => void,
): Partial<SuggestionOptions<SlashItem>> {
  return {
    items({ query }: { query: string }) {
      const q = query.toLowerCase();
      return q
        ? SLASH_ITEMS.filter((item) => item.label.toLowerCase().includes(q))
        : SLASH_ITEMS;
    },

    render() {
      let renderer: ReactRenderer<SlashMenuHandle, SlashMenuProps>;
      let popup: TippyInstance[];

      return {
        onStart(props) {
          renderer = new ReactRenderer(SlashMenuComponent, {
            props,
            editor: props.editor,
          });

          if (!props.clientRect) {
            popup = [];
            return;
          }

          popup = tippy("body", {
            getReferenceClientRect: props.clientRect as () => DOMRect,
            appendTo: () => document.body,
            content: renderer.element,
            showOnCreate: true,
            interactive: true,
            trigger: "manual",
            placement: "bottom-start",
          });
        },

        onUpdate(props) {
          renderer.updateProps(props);
          if (!props.clientRect) return;
          popup[0]?.setProps({
            getReferenceClientRect: props.clientRect as () => DOMRect,
          });
        },

        onKeyDown(props) {
          if (props.event.key === "Escape") {
            popup[0]?.hide();
            return true;
          }
          return renderer.ref?.onKeyDown(props.event) ?? false;
        },

        onExit() {
          popup[0]?.destroy();
          renderer.destroy();
        },
      };
    },

    command({
      editor,
      range,
      props: item,
    }: {
      editor: Editor;
      range: Range;
      props: SlashItem;
    }) {
      if (item.id === "h1") {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .toggleHeading({ level: 1 })
          .run();
      } else if (item.id === "h2") {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .toggleHeading({ level: 2 })
          .run();
      } else if (item.id === "h3") {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .toggleHeading({ level: 3 })
          .run();
      } else if (item.id === "divider") {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .setHorizontalRule()
          .run();
      } else if (item.id === "citation") {
        editor.chain().focus().deleteRange(range).run();
        onOpenCitationPicker();
      }
    },
  };
}
