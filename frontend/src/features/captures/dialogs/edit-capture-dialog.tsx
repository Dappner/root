"use client";

import type { BaseDialogProps } from "@/components/dialogs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CaptureForm, CaptureFormValues } from "@/features/captures/components/capture-form";
import { useUpdateCapture } from "@/features/captures/hooks";
import type { CaptureDTO } from "@/features/captures/types";
import type { CitationDTO } from "@/features/sources/types";
import { toast } from "sonner";

interface EditCaptureDialogProps extends BaseDialogProps {
  capture: CaptureDTO;
  citation?: CitationDTO;
}

export function EditCaptureDialog({
  open,
  onOpenChange,
  capture,
  citation,
}: EditCaptureDialogProps) {
  const updateCapture = useUpdateCapture();

  async function onSubmit(data: CaptureFormValues) {
    try {
      await updateCapture.mutateAsync({
        id: capture.id,
        data: {
          text: data.text.trim(),
          summary: "", // Keep existing logic TODO: Figure out the role of the field (e.g. should we even expose this...)
          source_id: capture.source_id ?? undefined,
          citation_id: capture.citation_id ?? undefined,
        },
      });

      toast.success("Comment updated successfully");
      onOpenChange(false);
    } catch (err) {
      console.error("Failed to update capture:", err);
      toast.error("Failed to update comment. Please try again.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Comment</DialogTitle>
        </DialogHeader>

        <CaptureForm
          onSubmit={onSubmit}
          onCancel={() => onOpenChange(false)}
          defaultValues={{ text: capture.text }}
          submitLabel="Save Changes"
        >
          {citation && (
            <div className="space-y-3 mb-2 rounded-lg border bg-muted/50 p-4 max-h-64 overflow-y-scroll">
              <div className="text-xs leading-relaxed">
                {citation.text}
              </div>

              {/* Context */}
              {citation.context && (
                <div className="text-sm text-muted-foreground">
                  {citation.context}
                </div>
              )}

              {/* Speaker */}
              {citation.speaker && (
                <div className="text-sm font-medium text-foreground">
                  — {citation.speaker}
                </div>
              )}
            </div>
          )}
        </CaptureForm>
      </DialogContent>
    </Dialog>
  );
}
