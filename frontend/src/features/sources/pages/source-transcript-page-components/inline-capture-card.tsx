"use client";

import { memo, useCallback, useState } from "react";
import { MessageSquare, Pencil, X } from "lucide-react";
import { useDialog } from "@/components/dialogs";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CitationDialog } from "@/features/sources/dialogs/citation-dialog";
import type { CaptureDTO, CitationDTO } from "@/features/sources/types";
import { cn } from "@/lib/utils";
import { setCitationHover } from "../source-transcript-page-utils/hover-highlight";

interface InlineCaptureCardProps {
  citation: CitationDTO;
  capture: CaptureDTO;
  /** "inline" = stacked under utterance; "gutter" = absolutely positioned in right margin. */
  variant?: "inline" | "gutter";
  /**
   * "saved" (default) edits via the CitationDialog. "suggestion" edits the
   * capture text inline (the dialog mutates the server, which is wrong for an
   * unsaved review draft).
   */
  mode?: "saved" | "suggestion";
  /** Suggestion mode only: persist the inline-edited draft text. */
  onSaveText?: (text: string) => void;
  /** Suggestion mode only: drop this capture from the note draft. */
  onRemove?: () => void;
  /** Review mode: belongs to the active suggestion (Phase C styles via data-attr). */
  isActiveSuggestion?: boolean;
}

export const InlineCaptureCard = memo(function InlineCaptureCard({
  citation,
  capture,
  variant = "inline",
  mode = "saved",
  onSaveText,
  onRemove,
  isActiveSuggestion,
}: InlineCaptureCardProps) {
  const { openDialog } = useDialog();
  const citationId = citation.id!;
  const isGutter = variant === "gutter";

  const [editing, setEditing] = useState(false);
  const [draftText, setDraftText] = useState(capture.text ?? "");

  const handleEdit = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (mode === "suggestion") {
        setDraftText(capture.text ?? "");
        setEditing(true);
        return;
      }
      openDialog(CitationDialog, {
        mode: "update",
        flow: "derived",
        citation,
        sourceId: citation.source_id,
      });
    },
    [mode, capture.text, openDialog, citation],
  );

  const handleSave = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onSaveText?.(draftText);
      setEditing(false);
    },
    [onSaveText, draftText],
  );

  const handleCancel = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setEditing(false);
  }, []);

  const handleRemove = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onRemove?.();
    },
    [onRemove],
  );

  return (
    <div
      data-citation-id={citationId}
      data-capture-card="true"
      data-capture-variant={variant}
      data-suggestion={mode === "suggestion" ? "true" : undefined}
      data-suggestion-active={isActiveSuggestion ? "true" : undefined}
      onMouseEnter={() => setCitationHover(citationId, true)}
      onMouseLeave={() => setCitationHover(citationId, false)}
      className={cn(
        "group rounded-md border transition-colors",
        isGutter
          ? "shadow-sm"
          : [
              "my-3 border-border/60 bg-card/60 px-3 py-2.5",
              "hover:border-border data-[citation-hover=true]:border-foreground/40",
              // Hidden when the gutter overlay is active (same card shown in margin).
              "[[data-gutter-active='true']_&]:hidden",
            ],
      )}
      style={
        isGutter
          ? { backgroundColor: "#f7e9a8", borderColor: "#d9c466", color: "#3b2f12" }
          : undefined
      }
    >
      {isGutter ? (
        <div className="space-y-2 p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs font-medium opacity-70">
              <MessageSquare className="size-3" />
              <span>Comment</span>
            </div>
            {!editing && (
              <div className="-mt-1 -mr-1 flex shrink-0 items-center gap-0.5">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleEdit}
                  aria-label="Edit comment"
                  title="Edit comment"
                  className="size-5 opacity-60 hover:opacity-100 hover:bg-black/5"
                >
                  <Pencil className="size-3" />
                </Button>
                {mode === "suggestion" && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleRemove}
                    aria-label="Remove comment"
                    title="Remove comment"
                    className="size-5 opacity-60 hover:opacity-100 hover:bg-black/5"
                  >
                    <X className="size-3" />
                  </Button>
                )}
              </div>
            )}
          </div>
          {editing ? (
            <InlineEditor
              value={draftText}
              onChange={setDraftText}
              onSave={handleSave}
              onCancel={handleCancel}
              textClassName="bg-white/60 text-xs"
            />
          ) : (
            <p className="whitespace-pre-wrap text-xs leading-snug">{capture.text}</p>
          )}
        </div>
      ) : editing ? (
        <InlineEditor
          value={draftText}
          onChange={setDraftText}
          onSave={handleSave}
          onCancel={handleCancel}
          textClassName="text-sm"
        />
      ) : (
        <div className="flex items-start justify-between gap-2">
          <p className="whitespace-pre-wrap text-sm leading-snug text-foreground">
            {capture.text}
          </p>
          <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleEdit}
              aria-label="Edit comment"
              className="size-7"
            >
              <Pencil className="size-3.5 text-muted-foreground" />
            </Button>
            {mode === "suggestion" && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleRemove}
                aria-label="Remove comment"
                className="size-7"
              >
                <X className="size-3.5 text-muted-foreground" />
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
});

interface InlineEditorProps {
  value: string;
  onChange: (text: string) => void;
  onSave: (e: React.MouseEvent) => void;
  onCancel: (e: React.MouseEvent) => void;
  textClassName?: string;
}

function InlineEditor({ value, onChange, onSave, onCancel, textClassName }: InlineEditorProps) {
  return (
    <div className="space-y-2">
      <Textarea
        autoFocus
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onClick={(e) => e.stopPropagation()}
        className={cn("min-h-16 resize-y leading-snug", textClassName)}
      />
      <div className="flex justify-end gap-1.5">
        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={onCancel}>
          Cancel
        </Button>
        <Button size="sm" className="h-7 px-2 text-xs" onClick={onSave}>
          Save
        </Button>
      </div>
    </div>
  );
}
