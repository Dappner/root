"use client";

import { useDialog } from "@/components/dialogs";
import { Button } from "@/components/ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { DeleteCaptureDialog } from "@/features/captures/dialogs/delete-capture-dialog";
import { EditCaptureDialog } from "@/features/captures/dialogs/edit-capture-dialog";
import type { CaptureDTO } from "@/features/captures/types";
import { MoveHighlightDialog } from "@/features/sources/dialogs/move-highlight-dialog";
import { MessageSquare, MoveRight, Pencil, Trash2 } from "lucide-react";

interface CaptureItemProps {
  capture: CaptureDTO;
  sourceId: number;
  currentSectionId?: number;
}

export function CaptureItem({
  capture,
  sourceId,
  currentSectionId,
}: CaptureItemProps) {
  const { openDialog } = useDialog();

  const handleMove = () => {
    if (!capture.id) return;
    openDialog(MoveHighlightDialog, {
      highlightId: capture.id,
      highlightType: "capture",
      sourceId,
      currentSectionId,
      highlightText: capture.text,
      highlightLocationLabel: null,
    });
  };

  const handleEdit = () => {
    openDialog(EditCaptureDialog, { capture });
  };

  const handleDeleteCapture = () => {
    openDialog(DeleteCaptureDialog, { capture });
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger render={
        <div id={capture.id ? `capture-${capture.id}` : undefined} className="flex items-start gap-3 p-3 border border-l-2 border-l-amber-700 rounded-lg hover:bg-muted/30 transition-colors scroll-mt-20">
          <div className="flex-1 min-w-0 space-y-2">
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{capture.text}</p>
            {capture.summary && (
              <p className="text-xs text-muted-foreground">Summary: {capture.summary}</p>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button variant="ghost" size="icon" onClick={handleEdit} aria-label="Edit comment">
              <MessageSquare className="h-4 w-4" />
            </Button>
          </div>
        </div>
      }>
      </ContextMenuTrigger>

      {/* Context Menu */}
      <ContextMenuContent className="w-48">
        <ContextMenuItem onClick={handleEdit}>
          <Pencil className="mr-2 h-4 w-4" />
          Edit Comment
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={handleMove}>
          <MoveRight className="mr-2 h-4 w-4" />
          Move to Section
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={handleDeleteCapture} className="text-destructive focus:text-destructive">
          <Trash2 className="mr-2 h-4 w-4" />
          Delete Comment
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
