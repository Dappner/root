"use client";

import { Clock, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldError } from "@/components/ui/field";
import { useSourceSections } from "@/features/sources/hooks/sections";
import { useSources } from "@/features/sources/hooks/sources";
import { useMetaEnter } from "@/hooks/use-meta-enter";
import { LeftColumn } from "./left-column";
import { RightColumn } from "./right-column";
import { CitationDialogProps, isDerivedProps, isManualProps } from "./types";
import { useCitationForm } from "./use-citation-form";
import {
  formatCitationLocation,
  getLocationTimestamp,
  type CitationLocation,
} from "@/features/sources/utils/location";
import { formatTime } from "@/lib/utils";

export type { CitationDialogProps } from "./types";

/**
 * Unified Citation Dialog
 *
 * A two-column dialog for creating and editing citations with notes:
 * - Left column: "What did the world say?" - Citation details
 * - Right column: "What do you say?" - Your thoughts/notes
 *
 * Supports 4 use cases via discriminated union props:
 * - TranscriptCreate: Quote from transcript (text/location read-only)
 * - TranscriptEdit: Edit transcript quote (text/location read-only)
 * - ManualCreate: Manual citation entry (all fields editable)
 * - ManualEdit: Edit manual citation (all fields editable)
 */
export function CitationDialog(props: CitationDialogProps) {
  const { open, onOpenChange } = props;

  const {
    form,
    onSubmit,
    isSubmitting,
    isDerived,
    isCreate,
    dialogTitle,
    submitLabel,
    submittingLabel,
    isDirty,
  } = useCitationForm(
    props,
    () => onOpenChange(false),
    () => {
      if ("onSaved" in props) {
        props.onSaved?.();
      }
    },
  );

  // Cmd/Ctrl+Enter is the single commit gesture: it folds any in-progress
  // capture draft into the staged set and commits the citation + captures
  // atomically (the form's onSubmit no-ops to a clean close when nothing
  // changed). Capture card edits handle their own Cmd+Enter locally and stop
  // propagation, so they never reach this handler.
  const handleKeyDown = useMetaEnter(() => {
    form.handleSubmit(onSubmit)();
  });

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      if (!form.formState.isSubmitSuccessful && "onCancel" in props) {
        props.onCancel?.();
      }
    }
    onOpenChange(nextOpen);
  };

  const displayTitle = dialogTitle;
  const displaySubmitLabel = submitLabel;

  // Extract context header data based on props type
  const { sourceId, sectionId, sectionTitle: sectionTitleFromProps } =
    getContextHeaderData(props);

  // Fetch sources to show context header (manual mode only)
  const { data: sourcesList } = useSources();
  const sources = sourcesList?.sources ?? [];
  const displaySource = sources.find((s) => s.id === sourceId);
  const { data: sections = [] } = useSourceSections(sourceId);
  const resolvedSectionTitle =
    sectionTitleFromProps ??
    sections.find((section) => section.id === sectionId)?.title;
  const truncatedSectionTitle = resolvedSectionTitle
    ? truncateLabel(resolvedSectionTitle, 30)
    : undefined;
  const headerLocation = getHeaderLocationLabel(props);
  const hasHeaderMeta =
    Boolean(headerLocation) || Boolean(displaySource) || Boolean(truncatedSectionTitle);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex max-h-[calc(100vh-4rem)] min-h-[min(680px,calc(100vh-4rem))] w-[calc(100vw-3rem)] max-w-6xl flex-col gap-0 overflow-hidden rounded-lg p-0 [&>*]:min-w-0">
        <DialogHeader className="border-b px-5 py-4 sm:px-6">
          <div className="flex items-start justify-between gap-3 pr-8">
            <DialogTitle className="text-lg font-semibold">{displayTitle}</DialogTitle>
            {isDirty && !isSubmitting && <UnsavedStatus />}
          </div>
          {hasHeaderMeta && (
            <div className="mt-3 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              {headerLocation && (
                <span className="flex min-w-0 items-center gap-2">
                  <Clock className="h-4 w-4 shrink-0" />
                  <span className="font-mono">{headerLocation}</span>
                </span>
              )}
              {displaySource && (
                <>
                  {headerLocation && <span className="text-muted-foreground/60">•</span>}
                  <span className="min-w-0 truncate">{displaySource.title}</span>
                </>
              )}
              {truncatedSectionTitle && (
                <>
                  {(headerLocation || displaySource) && (
                    <span className="text-muted-foreground/60">•</span>
                  )}
                  <span className="min-w-0 truncate">{truncatedSectionTitle}</span>
                </>
              )}
            </div>
          )}
        </DialogHeader>

        <form
          id="citation-dialog-form"
          onSubmit={form.handleSubmit(onSubmit)}
          onKeyDown={handleKeyDown}
          className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden md:grid-cols-[minmax(0,1.3fr)_minmax(340px,1fr)]"
        >
          {form.formState.errors.root?.server && (
            <div className="px-5 pt-5 md:col-span-2 md:px-6">
              <Field>
                <FieldError errors={[form.formState.errors.root?.server]} />
              </Field>
            </div>
          )}

          {/* Left column: Citation details */}
          <div className="min-h-0 overflow-y-auto px-5 py-5 md:px-6">
            <LeftColumn
              props={props}
              form={form}
              isDerived={isDerived}
              isCreate={isCreate}
            />
          </div>

          {/* Right column: staged captures + the always-present draft field. */}
          <div className="min-h-0 overflow-y-auto border-t px-5 py-5 md:border-l md:border-t-0 md:px-6">
            <RightColumn control={form.control} />
          </div>
        </form>

        <DialogFooter className="border-t px-5 py-4 sm:px-6">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="citation-dialog-form"
            disabled={isSubmitting}
          >
            {isSubmitting ? submittingLabel : displaySubmitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Extract source ID and section title based on props variant.
 * Uses discriminated union for type-safe access.
 */
function getContextHeaderData(props: CitationDialogProps): {
  sourceId: number | undefined;
  sectionId: number | undefined;
  sectionTitle: string | undefined;
} {
  if (isDerivedProps(props)) {
    if (props.mode === "create") {
      return { sourceId: props.sourceId, sectionId: undefined, sectionTitle: undefined };
    }
    return {
      sourceId: props.citation?.source_id,
      sectionId: props.citation?.section_id,
      sectionTitle: undefined,
    };
  }

  if (isManualProps(props)) {
    if (props.mode === "create") {
      return {
        sourceId: props.sourceId,
        sectionId: props.sectionId,
        sectionTitle: props.sectionTitle,
      };
    }
    // edit mode
    return {
      sourceId: props.citation?.source_id,
      sectionId: props.citation?.section_id,
      sectionTitle: undefined,
    };
  }

  return { sourceId: undefined, sectionId: undefined, sectionTitle: undefined };
}

function truncateLabel(label: string, maxLength: number) {
  if (label.length <= maxLength) return label;
  return `${label.slice(0, maxLength - 1)}…`;
}

function getHeaderLocationLabel(props: CitationDialogProps): string | null {
  const location =
    props.flow === "derived"
      ? props.mode === "create"
        ? props.location
        : props.citation?.location
      : props.mode === "update"
        ? props.citation?.location
        : undefined;
  const typedLocation = location as CitationLocation | null | undefined;
  const timestamp = getLocationTimestamp(typedLocation);

  if (timestamp) {
    const endLabel =
      timestamp.endSec !== undefined && timestamp.endSec !== timestamp.startSec
        ? ` – ${formatTime(timestamp.endSec)}`
        : "";
    return `${formatTime(timestamp.startSec)}${endLabel}`;
  }

  return formatCitationLocation(typedLocation);
}

/**
 * Header hint that the dialog holds unsaved edits. The whole dialog commits
 * atomically on Done / Cmd+Enter, so there is no per-field autosave to report —
 * this just signals "you have changes to save."
 */
function UnsavedStatus() {
  return (
    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <Pencil className="h-3.5 w-3.5" />
      Unsaved changes
    </span>
  );
}
