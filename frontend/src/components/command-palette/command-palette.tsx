"use client";

import { FileText, Globe, Keyboard } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { CommandGroup } from "./components/command-group";
import { useCommandPaletteController } from "./core/use-command-palette-controller";
import { KeyboardHints } from "./keyboard-hints";
import type { CommandActionSection } from "./core/types";

export interface RenderableAction {
  id: string;
  title: string;
  description?: string;
  icon: LucideIcon;
  keywords?: string[];
  shortcut?: string[];
  group: string;
  run: () => void | Promise<void>;
}

export interface CommandPaletteBreadcrumb {
  icon: LucideIcon;
  label: string;
  name: string;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  sections: CommandActionSection<RenderableAction>[];
  breadcrumb?: CommandPaletteBreadcrumb | null;
  leaderKey?: string;
  /** Called when the user toggles between contextual and global scope */
  onScopeChange?: (isGlobal: boolean) => void;
  /** Whether backspace-to-escape scope is available (i.e. a context is active) */
  canEscapeScope?: boolean;
}

export function CommandPalette({
  isOpen,
  onClose,
  sections,
  breadcrumb,
  leaderKey,
  onScopeChange,
  canEscapeScope = false,
}: CommandPaletteProps) {
  const [isGlobalScope, setIsGlobalScope] = useState(false);

  const setScope = (global: boolean) => {
    setIsGlobalScope(global);
    onScopeChange?.(global);
  };

  const commandSections = sections.map((section) => ({
    id: section.id,
    commands: section.actions.map((action) => ({
      id: action.id,
      label: action.title,
      description: action.description,
      icon: action.icon,
      keywords: action.keywords,
      shortcut: action.shortcut,
      action: action.run,
      group: action.group,
    })),
  }));

  const {
    inputValue,
    setInputValue,
    visibleCommandSections,
    navigableItems,
    selectedItemId,
    setSelectedItemId,
    listRef,
    handleInputKeyDown,
    handleOpenChange,
  } = useCommandPaletteController({
    commandSections,
    isOpen,
    leaderKey,
    onClose: () => {
      setScope(false);
      onClose();
    },
    onBackspaceAtEmpty: canEscapeScope ? () => setScope(true) : undefined,
  });
  const shortcutMode = Boolean(
    leaderKey && inputValue.trimStart().startsWith(leaderKey),
  );

  const executeCommand = (action: () => void | Promise<void>) => {
    void action();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="top-[12vh] flex max-h-[76vh] max-w-2xl translate-y-0 flex-col gap-0 overflow-hidden border border-border bg-popover p-0 text-popover-foreground shadow-2xl"
      >
        <DialogTitle className="sr-only">Command Menu</DialogTitle>

        {breadcrumb && !isGlobalScope && (
          <div className="flex items-center gap-2 border-b border-border bg-accent/50 px-4 py-2 text-sm">
            <breadcrumb.icon className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">{breadcrumb.label}</span>
            <span className="text-muted-foreground">/</span>
            <span className="truncate font-medium">{breadcrumb.name}</span>
          </div>
        )}

        {breadcrumb && isGlobalScope && (
          <div className="flex items-center gap-2 border-b border-border bg-accent/50 px-4 py-2 text-sm">
            <Globe className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">All Commands</span>
          </div>
        )}

        <div className="flex items-center border-b border-border bg-background px-4">
          {shortcutMode ? (
            <Keyboard className="mr-2 h-4 w-4 text-muted-foreground" />
          ) : (
            <FileText className="mr-2 h-4 w-4 text-muted-foreground" />
          )}
          <input
            value={inputValue}
            onChange={(event) => setInputValue(event.target.value)}
            onKeyDown={(event) =>
              handleInputKeyDown(event, { onCommandSelect: executeCommand })
            }
            placeholder={
              shortcutMode
                ? "Type a shortcut..."
                : breadcrumb && !isGlobalScope
                  ? `Search ${breadcrumb.label.toLowerCase()} commands...`
                  : "Type a command or search..."
            }
            className="h-auto w-full border-0 bg-transparent py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
          {shortcutMode && (
            <span className="ml-3 shrink-0 rounded bg-muted px-2 py-1 text-[11px] font-medium text-muted-foreground">
              Shortcut mode
            </span>
          )}
        </div>

        <div
          ref={listRef}
          className="min-h-0 flex-1 overflow-y-auto p-2"
          role="listbox"
          aria-label="Command options"
        >
          {navigableItems.length === 0 && (
            <div className="py-6 text-center text-sm text-muted-foreground">
              {shortcutMode ? "No shortcuts match." : "No results found."}
            </div>
          )}

          {visibleCommandSections.map((section, index) => (
            <CommandGroup
              key={section.id}
              heading={sections.find((s) => s.id === section.id)?.title ?? section.id}
              commands={section.commands}
              onSelect={executeCommand}
              className={index > 0 ? "mt-2" : undefined}
              selectedCommandId={selectedItemId?.replace(/^command:/, "") ?? null}
              onCommandHover={(commandId) => setSelectedItemId(`command:${commandId}`)}
            />
          ))}
        </div>

        <KeyboardHints leaderKey={leaderKey} />
      </DialogContent>
    </Dialog>
  );
}
