import { openSimplePickerResultAsync, type SimplePickerOption } from "@/components/pickers";
import type { SourceDTO } from "@/features/sources/types";

export type SourceOptionPickResult =
  | { kind: "cancel" }
  | { kind: "create" }
  | { kind: "source"; source: SourceDTO };

interface PickSourceOptionArgs {
  heading: string;
  sources: SourceDTO[];
}

type SourceChoice =
  | { kind: "create" }
  | { kind: "source"; source: SourceDTO };

export async function pickSourceOption({
  heading,
  sources,
}: PickSourceOptionArgs): Promise<SourceOptionPickResult> {
  const choices: SimplePickerOption<SourceChoice>[] = [
    { label: "+ Create New Source", value: { kind: "create" as const } },
    ...sources
      .filter((source) => source.id != null)
      .map((source) => ({
        label: source.title ?? "Untitled",
        value: { kind: "source" as const, source },
      })),
  ];

  const selection = await openSimplePickerResultAsync({
    title: heading,
    items: choices,
  });

  if (selection.kind !== "selected") {
    return { kind: "cancel" };
  }

  return selection.item;
}
