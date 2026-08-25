"use client";

import { DialogForm, DialogFormFooter, WithDialogResult, useDialogRuntime } from "@/components/dialogs";
import { useDeleteSection } from "@/features/sources/hooks/sections";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";

interface DeleteSectionDialogProps extends WithDialogResult<boolean> {
  sourceId: number;
  sectionId: number;
  sectionTitle: string;
  onSuccess?: () => void;
}

export function DeleteSectionDialog({
  sourceId,
  sectionId,
  sectionTitle,
  onSuccess,
}: DeleteSectionDialogProps) {
  const { resolve } = useDialogRuntime();
  const deleteSection = useDeleteSection(sourceId, sectionId);

  const handleDelete = async () => {
    try {
      await deleteSection.mutateAsync();
      toast.success("Section deleted successfully");
      resolve(true);
      onSuccess?.();
    } catch (error) {
      console.error("Failed to delete section:", error);
      toast.error("Failed to delete section. Please try again.");
    }
  };

  return (
    <DialogForm
      title={(
        <span className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          <span>Delete section?</span>
        </span>
      )}
      description={(
        <div className="space-y-2 pt-2 text-muted-foreground">
          <div>
            Are you sure you want to delete <strong>{sectionTitle}</strong>?
          </div>
          <div className="text-sm">
            Associated citations and captures will be moved to &quot;Unsorted&quot;
            and any subsections will be moved to the root level.
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
        pending={deleteSection.isPending}
        cancelDisabled={deleteSection.isPending}
      />
    </DialogForm>
  );
}
