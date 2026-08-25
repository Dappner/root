"use client";

import { useState } from "react";
import { Check, MessageSquarePlus, Pencil, Trash2 } from "lucide-react";
import type { IHighlight, ScaledPosition } from "@nicklasastorian/react-pdf-annotator";

export function HighlightActionBar({
  highlight,
  onEdit,
  onDelete,
}: {
  highlight: IHighlight;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="rounded-lg border bg-background shadow-lg p-2 flex items-center gap-2 max-w-[260px]">
      {highlight.comment ? (
        <div className="text-xs text-muted-foreground line-clamp-3">
          {highlight.comment}
        </div>
      ) : null}
      <button
        type="button"
        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-muted bg-background text-muted-foreground transition hover:text-foreground hover:border-border cursor-pointer"
        onClick={onEdit}
        title="Edit quote"
      >
        <Pencil className="h-4 w-4" />
      </button>
      <button
        type="button"
        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-muted bg-background text-muted-foreground transition hover:text-foreground hover:border-border cursor-pointer"
        onClick={onDelete}
        title="Delete highlight"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

export function SelectionActionBar({
  position,
  content,
  onSave,
  onAddQuote,
  onEdit,
  onDelete,
}: {
  position: ScaledPosition;
  content: { text?: string; image?: string };
  onSave: (
    position: ScaledPosition,
    content: { text?: string; image?: string },
  ) => Promise<IHighlight | null>;
  onAddQuote: (position: ScaledPosition, content: { text?: string; image?: string }) => void;
  onEdit: (highlight: IHighlight) => void;
  onDelete: (highlight: IHighlight) => void;
}) {
  const [savedHighlight, setSavedHighlight] = useState<IHighlight | null>(null);
  const canQuote = Boolean(content.text?.trim());

  if (savedHighlight) {
    return (
      <HighlightActionBar
        highlight={savedHighlight}
        onEdit={() => onEdit(savedHighlight)}
        onDelete={() => onDelete(savedHighlight)}
      />
    );
  }

  return (
    <div className="rounded-lg border bg-background shadow-lg p-1.5 flex items-center gap-1.5">
      <button
        type="button"
        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-muted bg-background text-muted-foreground transition hover:text-foreground hover:border-border cursor-pointer"
        onClick={() => {
          const tempHighlight: IHighlight = {
            id: `temp-${Date.now()}`,
            content,
            position,
            comment: "",
          };
          setSavedHighlight(tempHighlight);
          onSave(position, content).then((highlight) => {
            if (highlight) {
              setSavedHighlight(highlight);
            }
          });
        }}
        title="Save highlight"
      >
        <Check className="h-4 w-4" />
      </button>
      <button
        type="button"
        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-muted bg-background text-muted-foreground transition hover:text-foreground hover:border-border disabled:opacity-50 cursor-pointer"
        onClick={() => onAddQuote(position, content)}
        disabled={!canQuote}
        title="Add quote"
      >
        <MessageSquarePlus className="h-4 w-4" />
      </button>
    </div>
  );
}
