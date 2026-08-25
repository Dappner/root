"use client";

import type { Command as PaletteCommand } from "../types";
import { CommandItem } from "./command-item";
import { cn } from "@/lib/utils";

interface CommandGroupProps {
  heading: string;
  commands: PaletteCommand[];
  className?: string;
  onSelect: (action: () => void | Promise<void>) => void;
  selectedCommandId?: string | null;
  onCommandHover?: (commandId: string) => void;
}

export function CommandGroup({
  heading,
  commands,
  className,
  onSelect,
  selectedCommandId,
  onCommandHover,
}: CommandGroupProps) {
  if (commands.length === 0) {
    return null;
  }

  return (
    <section className={className}>
      <div className={cn("px-2 py-1.5 text-xs font-medium text-muted-foreground")}>
        {heading}
      </div>
      {commands.map((command) => (
        <CommandItem
          key={command.id}
          command={command}
          onSelect={onSelect}
          selected={selectedCommandId === command.id}
          onMouseEnter={() => onCommandHover?.(command.id)}
        />
      ))}
    </section>
  );
}
