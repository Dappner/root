"use client";

import { AutoGrowTextarea } from "@/components/forms/auto-grow-textarea";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Controller, UseFormReturn } from "react-hook-form";
import { CitationDialogFormValues } from "./schema";
import { CitationDialogProps } from "./types";
import { InfoTypeSelector } from "./components/info-type-selector";
import { LocationFields } from "./components/location-fields";

interface LeftColumnProps {
  props: CitationDialogProps;
  form: UseFormReturn<CitationDialogFormValues>;
  isDerived: boolean;
  isCreate: boolean;
}

/**
 * Left column: "What did the world say?"
 * - Derived mode: Read-only quote with timestamp/location
 * - Manual mode: Editable text, type selector, location fields
 */
export function LeftColumn({
  props,
  form,
  isDerived,
  isCreate,
}: LeftColumnProps) {
  if (isDerived) {
    return <DerivedFields props={props} form={form} />;
  }
  return <ManualFields form={form} isCreate={isCreate} />;
}

function DerivedFields({
  form,
}: {
  props: CitationDialogProps;
  form: UseFormReturn<CitationDialogFormValues>;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col gap-5">
      <div className="min-h-0 flex-1 space-y-2">
        <Controller
          name="text"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field className="h-full" data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="citation-text">
                Quote text <span className="text-destructive">*</span>
              </FieldLabel>
              <AutoGrowTextarea
                {...field}
                id="citation-text"
                autoFocus
                placeholder="Paste or edit the quote"
                minRows={14}
                maxRows={22}
                className="text-sm leading-7 md:text-sm"
              />
            </Field>
          )}
        />
      </div>

      <FieldGroup className="gap-4">
        <Controller
          name="speaker"
          control={form.control}
          render={({ field }) => (
            <Field>
              <FieldLabel htmlFor="speaker">Speaker (optional)</FieldLabel>
              <Input {...field} id="speaker" placeholder="Who said this?" />
            </Field>
          )}
        />
        <Controller
          name="context"
          control={form.control}
          render={({ field }) => (
            <Field>
              <FieldLabel htmlFor="context">Context (optional)</FieldLabel>
              <AutoGrowTextarea
                {...field}
                id="context"
                placeholder="Any relevant context..."
                minRows={1}
                maxRows={4}
              />
            </Field>
          )}
        />
      </FieldGroup>
    </div>
  );
}

function ManualFields({
  form,
  isCreate,
}: {
  form: UseFormReturn<CitationDialogFormValues>;
  isCreate: boolean;
}) {
  return (
    <div className="space-y-4">
      <FieldGroup className="gap-3">
        <InfoTypeSelector control={form.control} />

        <Controller
          name="text"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="citation-text">
                Text <span className="text-destructive">*</span>
              </FieldLabel>
              <AutoGrowTextarea
                {...field}
                id="citation-text"
                autoFocus
                placeholder="Paste or type the quote"
                minRows={10}
                maxRows={18}
                className="text-sm leading-7 md:text-sm"
              />
            </Field>
          )}
        />

        <Controller
          name="speaker"
          control={form.control}
          render={({ field }) => (
            <Field>
              <FieldLabel htmlFor="speaker">Speaker (optional)</FieldLabel>
              <Input {...field} id="speaker" placeholder="Who said this?" />
            </Field>
          )}
        />

        <Controller
          name="context"
          control={form.control}
          render={({ field }) => (
            <Field>
              <FieldLabel htmlFor="context">Context (optional)</FieldLabel>
              <AutoGrowTextarea
                {...field}
                id="context"
                placeholder="Any relevant context..."
                minRows={1}
                maxRows={4}
              />
            </Field>
          )}
        />

        <LocationFields form={form} />
      </FieldGroup>

      {!isCreate && (
        <div className="text-xs text-muted-foreground">
          Editing manual citations updates location and text.
        </div>
      )}
    </div>
  );
}
