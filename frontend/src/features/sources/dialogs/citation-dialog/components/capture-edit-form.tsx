"use client";

import { useState } from "react";
import { AutoGrowTextarea } from "@/components/forms/auto-grow-textarea";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface CaptureEditFormProps {
  initialText?: string;
  placeholder?: string;
  submitLabel?: string;
  autoFocus?: boolean;
  className?: string;
  textareaClassName?: string;
  minRows?: number;
  maxRows?: number;
  /** Controlled value. When provided (with onChange), the editor mirrors it
   *  instead of holding its own state — used so the add-editor stays in sync
   *  with the form's draft for commit-on-submit. */
  value?: string;
  onChange?: (text: string) => void;
  onSave: (text: string) => void;
  onCancel: () => void;
}

/**
 * Inline editor for a staged capture (new or existing). Cmd+Enter saves locally
 * and stops propagation so it never reaches the dialog's commit+close shortcut.
 */
export function CaptureEditForm({
  initialText = "",
  placeholder = "Add a thought…",
  submitLabel = "Save",
  autoFocus = true,
  className,
  textareaClassName,
  minRows = 3,
  maxRows = 10,
  value,
  onChange,
  onSave,
  onCancel,
}: CaptureEditFormProps) {
  const isControlled = value !== undefined && onChange !== undefined;
  const [internalText, setInternalText] = useState(initialText);
  const text = isControlled ? value : internalText;
  const setText = (next: string) => {
    if (isControlled) onChange(next);
    else setInternalText(next);
  };

  const trimmed = text.trim();
  // Card edits require a real change; the add-editor only requires non-empty.
  const canSave = trimmed.length > 0 && (isControlled || trimmed !== initialText.trim());

  const handleSave = () => {
    if (!canSave) return;
    onSave(trimmed);
  };

  return (
    <div className={cn("space-y-3", className)}>
      <AutoGrowTextarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder={placeholder}
        minRows={minRows}
        maxRows={maxRows}
        autoFocus={autoFocus}
        className={textareaClassName}
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
            event.preventDefault();
            event.stopPropagation();
            handleSave();
          }
          if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            onCancel();
          }
        }}
      />
      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="button" size="sm" disabled={!canSave} onClick={handleSave}>
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}
