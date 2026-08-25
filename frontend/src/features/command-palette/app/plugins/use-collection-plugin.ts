"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { useDialog } from "@/components/dialogs";
import {
  useCollection,
  useCollectionSourceIDs,
  useAddSourceToCollection,
} from "@/features/collections/hooks";
import { EditCollectionDialog } from "@/features/collections/dialogs/edit-collection-dialog";
import { DeleteCollectionDialog } from "@/features/collections/dialogs/delete-collection-dialog";
import { openAddSourceToCollectionPicker } from "@/features/collections/dialogs/add-source-to-collection-dialog";
import { useSources } from "@/features/sources/hooks/sources";
import type { AppState } from "../app-state";
import type { AppCommandAction } from "../types";

export function useCollectionPlugin(appState: AppState): AppCommandAction[] {
  const { openDialog } = useDialog();

  const { data: collection } = useCollection(appState.collectionId!);
  const { data: collectionSourceIDsDTO } = useCollectionSourceIDs(appState.collectionId!);
  const { data: sourcesResponse } = useSources();
  const addSourceToCollection = useAddSourceToCollection();

  const allSources = sourcesResponse?.sources ?? [];
  const collectionSourceIds = collectionSourceIDsDTO?.source_ids ?? [];

  if (!appState.collectionId || !collection) {
    return [];
  }

  const currentCollection = collection;

  return [
    {
      id: "context-collection-add-source",
      intent: "add-source-to-collection",
      title: "Add Source to Collection",
      icon: Plus,
      keywords: ["add", "source", "collection"],
      group: "context",
      priority: 120,
      run: () => {
        const existingIds = new Set(collectionSourceIds);
        const available = allSources.filter((s) => s.id != null && !existingIds.has(s.id));
        openAddSourceToCollectionPicker({
          collectionId: currentCollection.id,
          availableSources: available,
          addSource: addSourceToCollection.mutateAsync,
        });
      },
    },
    {
      id: "context-collection-edit",
      intent: "edit-collection",
      title: "Edit Collection",
      icon: Pencil,
      keywords: ["edit", "rename", "collection"],
      group: "context",
      priority: 110,
      run: () => openDialog(EditCollectionDialog, { collection: currentCollection }),
    },
    {
      id: "context-collection-delete",
      intent: "delete-collection",
      title: "Delete Collection",
      icon: Trash2,
      keywords: ["delete", "remove", "collection"],
      group: "context",
      priority: 100,
      run: () => openDialog(DeleteCollectionDialog, { collection: currentCollection }),
    },
  ];
}
