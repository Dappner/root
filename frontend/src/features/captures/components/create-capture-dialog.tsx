"use client";

import { toast } from "sonner";

import { ContextHeader } from "@/components/context-header";
import { BaseDialogProps, useDialog } from "@/components/dialogs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCreateCapture } from "@/features/captures/hooks";
import type { CitationDTO } from "@/features/sources/types";
import { BookOpen } from "lucide-react";
import { CaptureForm, CaptureFormValues } from "./capture-form";

interface CreateCaptureDialogProps extends BaseDialogProps {
  /** Source that the comment will belong to. Every comment must have one. */
  sourceId: number;
  sourceTitle?: string;
  citationId?: number;
  citation?: CitationDTO;
  sectionId?: number;
  sectionTitle?: string;
}

export function CreateCaptureDialog({
  open,
  onOpenChange,
  sourceId,
  sourceTitle,
  citationId,
  citation,
  sectionId,
  sectionTitle,
}: CreateCaptureDialogProps) {
  const createCapture = useCreateCapture();
  const { closeDialog } = useDialog();

  async function onSubmit(data: CaptureFormValues) {
    try {
      await createCapture.mutateAsync({
        text: data.text,
        source_id: sourceId,
        citation_id: citationId,
        section_id: sectionId,
      });

      // Refresh caches for source + captures
      toast.success("Comment created successfully");
      closeDialog();
    } catch (error) {
      console.error("Failed to create capture:", error);
      toast.error("Failed to create comment");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Add Comment</DialogTitle>
        </DialogHeader>

        <CaptureForm
          onSubmit={onSubmit}
          onCancel={() => onOpenChange(false)}
          submitLabel="Create Comment"
        >
          {sourceId && sourceTitle && (
            <ContextHeader
              primary={{
                label: sourceTitle,
                icon: BookOpen,
              }}
              secondary={
                sectionTitle
                  ? { label: sectionTitle }
                  : citationId
                    ? { label: "Linked to quote" }
                    : undefined
              }
            />
          )}

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
