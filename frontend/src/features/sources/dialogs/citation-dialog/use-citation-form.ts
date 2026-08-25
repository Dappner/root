"use client";

import { useCreateCitation, useCreateCitationFromSuggestion, useUpdateCitation } from "@/features/sources/hooks/citations";
import { useCapturesByCitation } from "@/features/captures/hooks";
import { useSources } from "@/features/sources/hooks/sources";
import {
  type CitationLocation,
  type ManualLocationType,
  mapSourceTypeToLocationType,
  secondsToHms,
} from "@/features/sources/utils/location";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { useEffect, useRef } from "react";
import { citationDialogSchema, CitationDialogFormValues } from "./schema";
import {
  diffCaptures,
  deltaIsEmpty,
  seedStagedCaptures,
  stageDraft,
  toCreatePayload,
} from "./captures-staging";
import { applyAPIFormError } from "@/lib/forms/apply-api-form-error";
import { CitationDialogProps } from "./types";
import type { CaptureDTO } from "@/features/captures/types";
import { buildLocationPayload } from "./utils";
import { formatTime } from "@/lib/utils";

const infoTypeEnum = ["quote", "stat", "fact", "paraphrase"] as const;

function normalizeInfoType(value?: string | null) {
  return infoTypeEnum.includes(value as (typeof infoTypeEnum)[number])
    ? (value as (typeof infoTypeEnum)[number])
    : "quote";
}

export interface UseCitationFormResult {
  form: ReturnType<typeof useForm<CitationDialogFormValues>>;
  onSubmit: (data: CitationDialogFormValues) => Promise<void>;
  isSubmitting: boolean;
  isDerived: boolean;
  isCreate: boolean;
  dialogTitle: string;
  submitLabel: string;
  submittingLabel: string;
  /** Whether the dialog holds unsaved edits (citation fields, staged captures,
   *  or a non-empty draft). Drives the header indicator. */
  isDirty: boolean;
}

function getInitialValues(props: CitationDialogProps): CitationDialogFormValues {
  const isDerived = props.flow === "derived";
  const isCreate = props.mode === "create";

  if (isDerived && isCreate && props.mode === "create") {
    return {
      info_type: "quote",
      text: props.quoteText,
      source_id: props.sourceId,
      speaker: "",
      context: "",
      captures: [],
      draftNote: "",
    };
  }

  if (isDerived && !isCreate && props.mode === "update") {
    return {
      info_type: normalizeInfoType(props.citation?.info_type),
      text: props.citation?.text || "",
      source_id: props.citation?.source_id || undefined,
      speaker: props.citation?.speaker || "",
      context: props.citation?.context || "",
      captures: [],
      draftNote: "",
    };
  }

  if (!isDerived && isCreate && props.mode === "create") {
    return {
      info_type: "quote",
      text: props.initialQuote || "",
      source_id: props.sourceId,
      section_id: props.sectionId,
      speaker: "",
      context: "",
      pageStart: props.initialPageStart ? String(props.initialPageStart) : "",
      pageEnd: props.initialPageEnd ? String(props.initialPageEnd) : "",
      tStart: props.initialTimestamp !== undefined ? formatTime(props.initialTimestamp) : "",
      tEnd: "",
      fallbackLabel: "",
      captures: [],
      draftNote: "",
    };
  }

  if (props.mode === "update") {
    const loc = props.citation?.location as CitationLocation | null;
    const book = loc?.type === "book_v1" ? loc.book : undefined;
    const av = loc?.type === "av_v1" ? loc.av : undefined;
    const other = loc?.type === "other_v1" ? loc.other : undefined;

    return {
      info_type: normalizeInfoType(props.citation?.info_type),
      text: props.citation?.text || "",
      source_id: props.citation?.source_id || undefined,
      section_id: props.citation?.section_id || undefined,
      speaker: props.citation?.speaker || "",
      context: props.citation?.context || "",
      pageStart: book?.pageStart ? String(book.pageStart) : "",
      pageEnd: book?.pageEnd ? String(book.pageEnd) : "",
      tStart: av?.tStartSec != null ? secondsToHms(av.tStartSec) : "",
      tEnd: av?.tEndSec != null ? secondsToHms(av.tEndSec) : "",
      fallbackLabel: other?.fallbackLabel || "",
      captures: [],
      draftNote: "",
    };
  }

  return {
    info_type: "quote",
    text: "",
    speaker: "",
    context: "",
    captures: [],
    draftNote: "",
  };
}

export function useCitationForm(
  props: CitationDialogProps,
  onClose: () => void,
  onSuccess?: () => void
): UseCitationFormResult {
  const createCitation = useCreateCitation();
  const createCitationFromSuggestion = useCreateCitationFromSuggestion();
  const updateCitation = useUpdateCitation();

  const { data: sourcesList } = useSources();
  const sources = sourcesList?.sources ?? [];

  const isCreate = props.mode === "create";
  const isDerived = props.flow === "derived";

  const editCitation = props.mode === "update" ? props.citation : undefined;

  const form = useForm<CitationDialogFormValues>({
    resolver: zodResolver(citationDialogSchema),
    defaultValues: getInitialValues(props),
  });

  // In edit mode, seed the staged captures from the citation's existing
  // captures once they load. `original` is the snapshot we diff against at
  // commit; staged edits never touch the network until then.
  const { data: existingCaptures = [] } = useCapturesByCitation(
    editCitation?.source_id ?? 0,
    editCitation?.id ?? 0,
  );
  const originalCaptures = useRef<CaptureDTO[]>([]);
  const seeded = useRef(false);
  useEffect(() => {
    if (isCreate || seeded.current || existingCaptures.length === 0) return;
    // The right column is editable before this query resolves. If the user
    // already staged a card or typed a draft, don't clobber their work — bail
    // and leave the unseeded server captures untouched (they're absent from
    // `originalCaptures`, so the diff never deletes or edits them).
    const draft = form.getValues("draftNote");
    if (form.getValues("captures").length > 0 || draft?.trim()) {
      seeded.current = true;
      return;
    }
    originalCaptures.current = existingCaptures;
    form.setValue("captures", seedStagedCaptures(existingCaptures), {
      shouldDirty: false,
    });
    seeded.current = true;
  }, [isCreate, existingCaptures, form]);

  const selectedSourceId = form.watch("source_id");
  const selectedSource = sources.find((s) => s.id === selectedSourceId);
  const locationType: ManualLocationType | null = selectedSource
    ? mapSourceTypeToLocationType(selectedSource.type)
    : null;

  const onSubmit = async (data: CitationDialogFormValues) => {
    form.clearErrors("root.server" as never);

    // Fold a non-empty bottom draft into the staged captures so the common
    // "one quote + one thought" flow commits without an explicit "Add".
    const staged = stageDraft(data.captures, data.draftNote);

    try {
      if (isCreate) {
        let citationPayload: Parameters<typeof createCitation.mutateAsync>[0];

        if (isDerived && props.mode === "create") {
          const basePayload = {
            info_type: data.info_type,
            text: data.text.trim(),
            source_id: props.sourceId,
            location: props.location as unknown as undefined,
            speaker: data.speaker?.trim() || undefined,
            context: data.context?.trim() || undefined,
            captures: toCreatePayload(staged),
          };

          if (props.suggestionId != null) {
            const result = await createCitationFromSuggestion.mutateAsync({
              ...basePayload,
              suggestion_id: props.suggestionId,
            });
            toast.success(result.captures.length > 0 ? "Citation and notes saved" : "Citation saved");
            onSuccess?.();
            onClose();
            return;
          }

          citationPayload = basePayload;
        } else if (!isDerived && props.mode === "create") {
          form.clearErrors(["pageStart", "pageEnd", "tStart", "tEnd", "fallbackLabel"]);
          const location = buildLocationPayload(data, locationType, form.setError);
          if (location === "error") return;

          citationPayload = {
            info_type: data.info_type,
            text: data.text.trim(),
            source_id: data.source_id ?? props.sourceId,
            section_id: data.section_id ?? props.sectionId,
            location: location || undefined,
            speaker: data.speaker?.trim() || undefined,
            context: data.context?.trim() || undefined,
            captures: toCreatePayload(staged),
          };
        } else {
          return;
        }

        const result = await createCitation.mutateAsync(citationPayload);
        toast.success(result.captures.length > 0 ? "Citation and notes saved" : "Citation saved");
        onSuccess?.();
        onClose();
        return;
      }

      const citation = props.mode === "update" ? props.citation : undefined;
      if (!citation?.id) return;
      const mutationSourceId = props.mode === "update"
        ? props.sourceId ?? citation.source_id
        : undefined;

      const delta = diffCaptures(staged, originalCaptures.current);
      const citationDirty =
        form.formState.dirtyFields.info_type ||
        form.formState.dirtyFields.text ||
        form.formState.dirtyFields.speaker ||
        form.formState.dirtyFields.context ||
        form.formState.dirtyFields.pageStart ||
        form.formState.dirtyFields.pageEnd ||
        form.formState.dirtyFields.tStart ||
        form.formState.dirtyFields.tEnd ||
        form.formState.dirtyFields.fallbackLabel;

      // Nothing changed (no citation edits, no capture delta): Done is a pure
      // close — skip the PATCH and toast.
      if (!citationDirty && deltaIsEmpty(delta)) {
        onClose();
        return;
      }

      const capturesField = deltaIsEmpty(delta) ? undefined : delta;

      if (isDerived) {
        await updateCitation.mutateAsync({
          id: citation.id,
          sourceId: mutationSourceId,
          data: {
            info_type: data.info_type,
            text: data.text.trim(),
            location: citation.location,
            speaker: data.speaker?.trim() ? data.speaker.trim() : null,
            context: data.context?.trim() ? data.context.trim() : null,
            captures: capturesField,
          },
        });
      } else {
        form.clearErrors(["pageStart", "pageEnd", "tStart", "tEnd", "fallbackLabel"]);
        const location = buildLocationPayload(data, locationType, form.setError);
        if (location === "error") return;

        await updateCitation.mutateAsync({
          id: citation.id,
          sourceId: mutationSourceId,
          data: {
            info_type: data.info_type,
            text: data.text.trim(),
            location: location || undefined,
            speaker: data.speaker?.trim() ? data.speaker.trim() : null,
            context: data.context?.trim() ? data.context.trim() : null,
            captures: capturesField,
          },
        });
      }

      toast.success("Citation updated");
      onSuccess?.();
      onClose();
    } catch (error) {
      console.error("Failed to save citation:", error);
      applyAPIFormError(form, error, {
        fallbackMessage: `Failed to ${isCreate ? "create" : "update"} citation.`,
      });
    }
  };

  const isSubmitting =
    form.formState.isSubmitting ||
    createCitation.isPending ||
    createCitationFromSuggestion.isPending ||
    updateCitation.isPending;

  const draftNote = form.watch("draftNote");
  const isDirty = form.formState.isDirty || Boolean(draftNote?.trim());

  const dialogTitle = isCreate
    ? isDerived ? "Save Quote" : "Add Citation"
    : isDerived ? "Edit Quote" : "Edit Citation";

  const submitLabel = isCreate
    ? isDerived ? "Save Quote" : "Create Citation"
    : "Done";

  return {
    form,
    onSubmit,
    isSubmitting,
    isDerived,
    isCreate,
    dialogTitle,
    submitLabel,
    submittingLabel: isCreate ? "Saving..." : "Updating...",
    isDirty,
  };
}
