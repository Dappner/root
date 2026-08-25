export interface CommandLike {
  id: string;
  action: () => void | Promise<void>;
}

export interface CommandSectionLike<TCommand extends CommandLike> {
  id: string;
  commands: TCommand[];
}

export type NavigableItem<TCommand extends CommandLike> = {
  id: `command:${string}`;
  kind: "command";
  command: TCommand;
};

interface BuildNavigableItemsArgs<TCommand extends CommandLike> {
  visibleCommandSections: CommandSectionLike<TCommand>[];
}

export function buildNavigableItems<TCommand extends CommandLike>({
  visibleCommandSections,
}: BuildNavigableItemsArgs<TCommand>): NavigableItem<TCommand>[] {
  return visibleCommandSections.flatMap((section) =>
    section.commands.map((command) => ({
      id: `command:${command.id}` as const,
      kind: "command" as const,
      command,
    })),
  );
}
