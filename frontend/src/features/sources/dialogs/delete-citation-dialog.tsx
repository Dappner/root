"use client";

import { DialogForm, DialogFormFooter, WithDialogResult, useDialogRuntime } from "@/components/dialogs";
import { useDeleteCitation } from "@/features/sources/hooks/citations";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { CitationDTO } from "../types";

interface DeleteCitationDialogProps extends WithDialogResult<boolean> {
  citation: CitationDTO;
  sourceId?: number;
  hasCapture?: boolean;
}

export function DeleteCitationDialog({
  citation,
  hasCapture,
}: DeleteCitationDialogProps) {
  const { resolve } = useDialogRuntime();
  const deleteCitation = useDeleteCitation();

  const handleDelete = async () => {
    try {
      await deleteCitation.mutateAsync({ id: citation.id, sourceId: citation.source_id });
      toast.success("Citation deleted successfully");
      resolve(true);
    } catch (error) {
      console.error("Failed to delete citation:", error);
      toast.error("Failed to delete citation. Please try again.");
    }
  };

  return (
    <DialogForm
      title={(
        <span className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          <span>Delete citation?</span>
        </span>
      )}
      description={(
        <div className="space-y-2 pt-2 text-muted-foreground">
          <div>
            Are you sure you want to delete this citation?
          </div>
          {hasCapture && (
            <div className="text-sm font-medium text-destructive">
              This will also delete the associated note/capture.
            </div>
          )}
          <div className="text-sm text-muted-foreground p-2 bg-muted rounded-md mt-2 italic border border-border">
            &quot;{citation.text.length > 100 ? `${citation.text.slice(0, 100)}...` : citation.text}&quot;
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
        pending={deleteCitation.isPending}
        cancelDisabled={deleteCitation.isPending}
      />
    </DialogForm>
  );
}
