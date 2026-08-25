"use client";

import { createPicker, openPickerResultAsync } from "@/components/pickers";
import type { SourceDTO } from "@/features/sources/types";

const addSourcePicker = createPicker<SourceDTO>({
  id: "add-source-to-collection-picker",
  getKey: (item) => String(item.id),
  getLabel: (item) => item.title || "(Untitled)",
  getKeywords: (item) =>
    [item.title, item.author, item.type].filter((value): value is string => Boolean(value)),
});

export async function openAddSourceToCollectionPicker({
  collectionId,
  availableSources,
  addSource,
}: {
  collectionId: number;
  availableSources: SourceDTO[];
  addSource: (args: { collectionId: number; sourceId: number }) => Promise<unknown>;
  }) {
  const selection = await openPickerResultAsync(addSourcePicker, {
    title: "Add Source to Collection",
    items: availableSources.filter((source) => source.id != null),
  });

  if (selection.kind !== "selected") {
    return;
  }

  const sourceId = Number(selection.item.id);
  if (!Number.isNaN(sourceId)) {
    await addSource({ collectionId, sourceId });
  }
}
