import * as z from "zod";

/**
 * A capture staged in the dialog. Nothing here is persisted until the dialog's
 * primary action (Done / Cmd+Enter) commits the citation and its captures in a
 * single atomic request. `id` is set only for captures that already exist on
 * the server (edit-mode seed); `originalText` lets us diff edits at commit.
 */
export const stagedCaptureSchema = z.object({
  key: z.string(),
  id: z.number().optional(),
  text: z.string(),
  originalText: z.string().optional(),
});

export type StagedCapture = z.infer<typeof stagedCaptureSchema>;

/**
 * Form schema for the unified citation dialog.
 *
 * Captures are staged in `captures` (committed cards) plus a live `draftNote`
 * (the always-present bottom field). Both are local until the dialog commits.
 */
export const citationDialogSchema = z.object({
  // Citation fields
  info_type: z.enum(["quote", "stat", "fact", "paraphrase"]),
  text: z.string().min(1, "Citation text is required"),
  source_id: z.number().optional(),
  section_id: z.number().optional(),
  speaker: z.string().optional(),
  context: z.string().optional(),

  // Location fields (manual context only)
  pageStart: z.string().optional(),
  pageEnd: z.string().optional(),
  tStart: z.string().optional(),
  tEnd: z.string().optional(),
  fallbackLabel: z.string().optional(),

  // Captures (right column). Staged locally; committed atomically on submit.
  // Always provided by getInitialValues, so it stays required (no `.default`,
  // which would make the resolver's input type optional and mismatch RHF).
  captures: z.array(stagedCaptureSchema),
  // The always-present bottom field. A non-empty draft is auto-committed as a
  // capture on submit, so the common "one quote + one thought" flow needs no
  // explicit "add" click.
  draftNote: z.string().optional(),
});

export type CitationDialogFormValues = z.infer<typeof citationDialogSchema>;

// Alias for backwards compatibility with shared components
export type CitationFormValues = CitationDialogFormValues;
