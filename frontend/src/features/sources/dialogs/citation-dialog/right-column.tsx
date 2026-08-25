"use client";

import { useEffect, useState } from "react";
import { Plus, MessageSquarePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFieldArray, type Control, useController } from "react-hook-form";
import { CaptureCard } from "./components/capture-card";
import { CaptureEditForm } from "./components/capture-edit-form";
import { nextStagedKey } from "./captures-staging";
import type { CitationDialogFormValues } from "./schema";

interface RightColumnProps {
  control: Control<CitationDialogFormValues>;
  /** Mobile/read surfaces hide the editing affordances. */
  readOnly?: boolean;
}

/**
 * Right column: "What do you say?"
 *
 * Captures are staged locally — nothing is persisted until the dialog's primary
 * action commits the citation and its captures atomically. Staged thoughts show
 * as compact cards; a dashed "+ Add thought" opens an inline editor below them.
 *
 * The open editor's text mirrors the form's `draftNote` so that committing the
 * dialog (Done / Cmd+Enter) auto-folds a half-typed thought into the staged set
 * — the form hook reads `draftNote` on submit. Saving the editor explicitly
 * stages it as a card.
 */
export function RightColumn({ control, readOnly }: RightColumnProps) {
  const { fields, append, update, remove } = useFieldArray({
    control,
    name: "captures",
    keyName: "_fieldId",
  });
  const { field: draft } = useController({ control, name: "draftNote" });
  const [editingKey, setEditingKey] = useState<string | null>(null);
  // Open the inline add-editor automatically when there are no thoughts yet, so
  // the common "jot one reflection" path needs no extra click.
  const [drafting, setDrafting] = useState(fields.length === 0);

  const count = fields.length;

  // Auto-open the editor only while empty (the fast "jot one thought" path).
  // Once cards exist — including after async seeding in edit mode — collapse to
  // the dashed "+ Add thought" button so it's opt-in, matching the design.
  useEffect(() => {
    setDrafting(count === 0);
  }, [count]);

  const stageDraftText = (text: string) => {
    const trimmed = text.trim();
    if (trimmed) append({ key: nextStagedKey(), text: trimmed });
    draft.onChange("");
    setDrafting(count === 0 && !trimmed);
  };

  return (
    <div className="flex h-full flex-col">
      <div>
        <h3 className="text-lg font-semibold">
          Thoughts{count > 0 ? ` (${count})` : ""}
        </h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Notes and captures attached to this quote.
        </p>
      </div>

      <div className="mt-6 flex flex-1 flex-col gap-3">
        {fields.map((staged, index) => (
          <CaptureCard
            key={staged._fieldId}
            text={staged.text}
            isEditing={editingKey === staged.key}
            readOnly={readOnly}
            onStartEdit={() => setEditingKey(staged.key)}
            onCancelEdit={() => setEditingKey(null)}
            onSave={(text) => {
              update(index, { ...staged, text });
              setEditingKey(null);
            }}
            onDelete={() => {
              remove(index);
              if (editingKey === staged.key) setEditingKey(null);
            }}
          />
        ))}

        {!readOnly && drafting && (
          <>
            <CaptureEditForm
              key={count}
              placeholder={getPlaceholder(count)}
              submitLabel="Add thought"
              autoFocus={count > 0}
              minRows={count > 0 ? 2 : 3}
              maxRows={6}
              textareaClassName="text-sm leading-6 md:text-sm"
              value={draft.value ?? ""}
              onChange={draft.onChange}
              onSave={stageDraftText}
              onCancel={() => {
                draft.onChange("");
                setDrafting(false);
              }}
            />
          </>
        )}

        {!readOnly && !drafting && (
          <button
            type="button"
            onClick={() => setDrafting(true)}
            className="flex items-center justify-center gap-2 rounded-lg border border-dashed py-5 text-sm font-medium text-primary transition-colors hover:bg-muted/40"
          >
            <Plus className="h-4 w-4" />
            Add thought
          </button>
        )}

        {count === 0 && readOnly && (
          <div className="flex flex-1 flex-col items-center justify-center rounded-lg border border-dashed py-10 text-center">
            <MessageSquarePlus className="mb-3 h-6 w-6 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No thoughts yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Encouraging placeholder for the capture draft. Cycles per-minute so it varies
 * without jarring mid-edit changes.
 */
function getPlaceholder(count: number): string {
  if (count > 0) return "Add another thought…";
  const prompts = [
    "What does this make you think? Why did it stand out?",
    "Does this connect to something else you've read or experienced?",
    "Is this an example, principle, or contradiction?",
    "What's the key insight here? How might you apply it?",
    "Why is this meaningful to you?",
  ];
  const index = Math.floor(Date.now() / 60000) % prompts.length;
  return prompts[index];
}
