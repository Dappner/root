"use client";

import { DialogForm, DialogFormFooter, useDialogRuntime, WithDialogResult } from "@/components/dialogs";
import { useDeleteCollection } from "@/features/collections/hooks";
import type { CollectionDTO } from "@/features/collections/types";
import { routes } from "@/lib/routes";
import { AlertTriangle } from "lucide-react";
import { useRouter } from "@/lib/nav";

interface DeleteCollectionDialogProps extends WithDialogResult<boolean> {
  collection: CollectionDTO;
}

export function DeleteCollectionDialog({ collection }: DeleteCollectionDialogProps) {
  const router = useRouter();
  const { resolve } = useDialogRuntime();
  const deleteCollection = useDeleteCollection();

  const handleDelete = async () => {
    try {
      await deleteCollection.mutateAsync(collection.id);
      resolve(true);
      router.push(routes.collections);
    } catch (error) {
      console.error("Failed to delete collection:", error);
    }
  };

  return (
    <DialogForm
      title={(
        <span className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          <span>Delete collection?</span>
        </span>
      )}
      description={(
        <div className="space-y-2 pt-2 text-muted-foreground">
          <div>
            Are you sure you want to delete <strong>{collection.name}</strong>?
          </div>
          <div className="text-sm">
            The sources in this collection will not be deleted.
          </div>
        </div>
      )}
      className="max-w-md"
      onSubmit={(event) => {
        event.preventDefault();
        handleDelete();
      }}
    >
      <DialogFormFooter
        submitLabel="Delete"
        submitVariant="destructive"
        pendingLabel="Deleting..."
        pending={deleteCollection.isPending}
        cancelDisabled={deleteCollection.isPending}
      />
    </DialogForm>
  );
}
