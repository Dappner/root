"use client";

import { DialogForm, DialogFormFooter, WithDialogResult, useDialogRuntime } from "@/components/dialogs";
import { useDeleteSource } from "@/features/sources/hooks/sources";
import { routes } from "@/lib/routes";
import { AlertTriangle } from "lucide-react";
import { useRouter } from "@/lib/nav";

interface DeleteSourceDialogProps extends WithDialogResult<boolean> {
  sourceId: number;
  sourceTitle: string;
}

export function DeleteSourceDialog({
  sourceId,
  sourceTitle,
}: DeleteSourceDialogProps) {
  const router = useRouter();
  const { resolve } = useDialogRuntime();
  const deleteSource = useDeleteSource();

  const handleDelete = async () => {
    try {
      await deleteSource.mutateAsync(sourceId);
      resolve(true);
      router.push(routes.library);
    } catch (error) {
      console.error("Failed to delete source:", error);
    }
  };

  return (
    <DialogForm
      title={(
        <span className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          <span>Delete source?</span>
        </span>
      )}
      description={(
        <div className="space-y-2 pt-2 text-muted-foreground">
          <div>
            Are you sure you want to delete <strong>{sourceTitle}</strong>?
          </div>
          <div className="text-sm">
            Associated captures and citations will have their source
            reference removed, but will not be deleted.
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
        pending={deleteSource.isPending}
        cancelDisabled={deleteSource.isPending}
      />
    </DialogForm>
  );
}
