"use client";

import { useDialog } from "@/components/dialogs";
import { createPicker, openPickerResultAsync } from "@/components/pickers";
import { CreateCollectionDialog } from "./create-collection-dialog";

interface CollectionPickerItem {
  id: number;
  name: string;
  inCollection: boolean;
}

const sourceCollectionPicker = createPicker<CollectionPickerItem>({
  id: "source-collection-picker",
  getKey: (item) => String(item.id),
  getLabel: (item) => item.name,
  getKeywords: (item) => [item.name, item.inCollection ? "in collection remove" : "add"].filter(
    (value): value is string => Boolean(value),
  ),
  renderItem: ({ item, selected }) => (
    <div className="flex flex-col gap-0.5">
      <span>{item.name}</span>
      {item.inCollection ? (
        <span className="text-xs text-muted-foreground">
          {selected ? "Remove from collection" : "✓ In collection"}
        </span>
      ) : selected ? (
        <span className="text-xs text-muted-foreground">Add to collection</span>
      ) : null}
    </div>
  ),
});

export async function openSourceCollectionPicker({
  sourceId,
  collectionIds,
  collections,
  addToCollection,
  removeFromCollection,
  openDialog,
}: {
  sourceId: number;
  collectionIds: number[];
  collections: { id: number; name: string }[];
  addToCollection: (args: { collectionId: number; sourceId: number }) => void;
  removeFromCollection: (args: { collectionId: number; sourceId: number }) => void;
  openDialog: ReturnType<typeof useDialog>["openDialog"];
  }) {
  const inCollectionSet = new Set(collectionIds);

  const selection = await openPickerResultAsync(sourceCollectionPicker, {
    title: "Add to Collection",
    items: collections.map((collection) => ({
      id: collection.id,
      name: collection.name,
      inCollection: inCollectionSet.has(collection.id),
    })),
    actions: [{ id: "create", label: "+ New collection" }],
  });

  if (selection.kind === "cancel" || selection.kind === "back") {
    return;
  }

  if (selection.kind === "action") {
    openDialog(CreateCollectionDialog);
    return;
  }

  const collectionId = Number(selection.item.id);
  if (Number.isNaN(collectionId)) {
    return;
  }

  if (inCollectionSet.has(collectionId)) {
    removeFromCollection({ collectionId, sourceId });
  } else {
    addToCollection({ collectionId, sourceId });
  }
}
