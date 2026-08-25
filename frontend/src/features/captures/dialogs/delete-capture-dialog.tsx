"use client";

import { DialogForm, DialogFormFooter, WithDialogResult, useDialogRuntime } from "@/components/dialogs";
import { useDeleteCapture } from "@/features/captures/hooks";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { CaptureDTO } from "../types";

interface DeleteCaptureDialogProps extends WithDialogResult<boolean> {
  capture: CaptureDTO;
}

export function DeleteCaptureDialog({
  capture,
}: DeleteCaptureDialogProps) {
  const { resolve } = useDialogRuntime();
  const deleteCapture = useDeleteCapture();

  const handleDelete = async () => {
    try {
      await deleteCapture.mutateAsync({ id: capture.id, sourceId: capture.source_id });
      toast.success("Capture deleted successfully");
      resolve(true);
    } catch (error) {
      console.error("Failed to delete capture:", error);
      toast.error("Failed to delete capture. Please try again.");
    }
  };

  return (
    <DialogForm
      title={(
        <span className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          <span>Delete comment?</span>
        </span>
      )}
      description={(
        <div className="space-y-2 pt-2 text-muted-foreground">
          <div>
            Are you sure you want to delete this comment? This action cannot be undone.
          </div>
          {capture.text && (
            <div className="text-sm text-muted-foreground p-2 bg-muted rounded-md mt-2 italic border border-border">
              &quot;{capture.text.length > 100 ? `${capture.text.slice(0, 100)}...` : capture.text}&quot;
            </div>
          )}
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
        pending={deleteCapture.isPending}
        cancelDisabled={deleteCapture.isPending}
      />
    </DialogForm>
  );
}
