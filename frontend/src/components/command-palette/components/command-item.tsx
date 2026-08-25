"use client";

import type { Command as PaletteCommand } from "../types";
import { cn } from "@/lib/utils";

interface CommandItemProps {
  command: PaletteCommand;
  onSelect: (action: () => void | Promise<void>) => void;
  selected?: boolean;
  onMouseEnter?: () => void;
}

export function CommandItem({ command, onSelect, selected = false, onMouseEnter }: CommandItemProps) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      onClick={() => onSelect(command.action)}
      onMouseEnter={onMouseEnter}
      className={cn(
        "group flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm cursor-pointer",
        selected ? "bg-accent text-accent-foreground" : "text-foreground",
      )}
    >
      <command.icon className={cn("w-4 h-4", selected ? "text-accent-foreground" : "text-muted-foreground")} />
      <span>{command.label}</span>
      {command.shortcut && command.shortcut.length > 0 && (
        <span className="ml-auto flex items-center gap-1">
          {command.shortcut.map((key, index) => (
            <kbd
              key={`${command.id}-${key}-${index}`}
              className={cn(
                "rounded px-1.5 py-0.5 text-[10px] font-mono leading-none",
                selected
                  ? "bg-accent-foreground/10 text-accent-foreground"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {key}
            </kbd>
          ))}
        </span>
      )}
    </button>
  );
}
