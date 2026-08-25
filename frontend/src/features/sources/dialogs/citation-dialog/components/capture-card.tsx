"use client";

import { useState } from "react";
import { MessageSquare, MoreVertical, Trash2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CaptureEditForm } from "./capture-edit-form";

interface CaptureCardProps {
  text: string;
  isEditing: boolean;
  readOnly?: boolean;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSave: (text: string) => void;
  onDelete: () => void;
}

/**
 * A single staged capture. Collapsed to a compact read card by default; expands
 * to an inline editor on demand. All edits mutate local form state — nothing is
 * persisted until the dialog commits.
 */
export function CaptureCard({
  text,
  isEditing,
  readOnly,
  onStartEdit,
  onCancelEdit,
  onSave,
  onDelete,
}: CaptureCardProps) {
  return (
    <div className="rounded-lg border bg-card/40 shadow-sm">
      <div className="p-3">
        {isEditing && !readOnly ? (
          <CaptureEditForm
            initialText={text}
            submitLabel="Save"
            minRows={2}
            maxRows={6}
            textareaClassName="text-sm leading-6 md:text-sm"
            onSave={onSave}
            onCancel={onCancelEdit}
          />
        ) : (
          <ReadMode
            text={text}
            readOnly={readOnly}
            onStartEdit={onStartEdit}
            onDelete={onDelete}
          />
        )}
      </div>
    </div>
  );
}

function ReadMode({
  text,
  readOnly,
  onStartEdit,
  onDelete,
}: {
  text: string;
  readOnly?: boolean;
  onStartEdit: () => void;
  onDelete: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="group/card flex items-start gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
        <MessageSquare className="h-3.5 w-3.5" />
      </div>

      <div className="min-w-0 flex-1">
        <p className="whitespace-pre-wrap text-sm font-medium leading-relaxed">{text}</p>
      </div>

      {!readOnly && (
        <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 opacity-70 group-hover/card:opacity-100 data-[popup-open]:opacity-100"
                aria-label="Capture actions"
              />
            }
          >
            <MoreVertical className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onStartEdit}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onDelete} variant="destructive">
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
