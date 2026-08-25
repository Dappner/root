"use client";

import { Button } from "@/components/ui/button";
import { useDialog } from "@/components/dialogs";
import { CreateCollectionDialog } from "../dialogs/create-collection-dialog";
import { Layers, Plus } from "lucide-react";

export function CollectionsEmptyState() {
  const { openDialog } = useDialog();

  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="rounded-full bg-secondary/50 p-6 mb-6">
        <Layers className="h-10 w-10 text-muted-foreground" />
      </div>
      <h2 className="text-xl font-semibold mb-2">No collections yet</h2>
      <p className="text-muted-foreground max-w-sm mb-6">
        Create a collection to group your sources. For example, a monthly newsletter, a reading list, or a research project.
      </p>
      <Button onClick={() => openDialog(CreateCollectionDialog)}>
        <Plus className="w-4 h-4 mr-2" />
        Create Collection
      </Button>
    </div>
  );
}
