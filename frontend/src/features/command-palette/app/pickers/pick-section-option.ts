import { openSimplePickerResultAsync, type SimplePickerOption } from "@/components/pickers";
import type { SourceSectionDTO } from "@/features/sources/types";

export type SectionOptionPickResult =
  | { kind: "cancel" }
  | { kind: "back" }
  | { kind: "unassigned" }
  | { kind: "create" }
  | { kind: "section"; section: SourceSectionDTO };

interface PickSectionOptionArgs {
  heading: string;
  sections: SourceSectionDTO[];
  unassignedLabel: string;
  unassignedDescription: string;
  hasParent?: boolean;
}

type SectionChoice =
  | { kind: "unassigned" }
  | { kind: "create" }
  | { kind: "section"; section: SourceSectionDTO };

export async function pickSectionOption({
  heading,
  sections,
  unassignedLabel,
  unassignedDescription,
  hasParent = false,
}: PickSectionOptionArgs): Promise<SectionOptionPickResult> {
  const choices: SimplePickerOption<SectionChoice>[] = [
    {
      label: unassignedLabel,
      value: { kind: "unassigned" },
      description: unassignedDescription,
    },
    {
      label: "+ Create New Section",
      value: { kind: "create" },
      description: "Add a new section first",
    },
    ...sections.map((section) => {
      const description = buildSectionDescription(section);

      return {
        label: section.title,
        value: { kind: "section" as const, section },
        description,
      } satisfies SimplePickerOption<SectionChoice>;
    }),
  ];

  const selection = await openSimplePickerResultAsync({
    title: heading,
    hasParent,
    items: choices,
  });

  if (selection.kind === "back") {
    return { kind: "back" };
  }

  if (selection.kind !== "selected") {
    return { kind: "cancel" };
  }

  return selection.item;
}

function buildSectionDescription(section: SourceSectionDTO) {
  const range = [section.range_start, section.range_end]
    .filter((value) => value !== undefined && value !== null)
    .join("-");

  if (range) {
    return `Range ${range}`;
  }

  return "Open section detail";
}
