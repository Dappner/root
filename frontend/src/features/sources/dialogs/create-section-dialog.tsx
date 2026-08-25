"use client";

import { DialogForm, DialogFormFooter, WithDialogResult, useDialogRuntime } from "@/components/dialogs";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useCreateSection } from "@/features/sources/hooks/sections";
import type { SourceDTO, SourceSectionDTO } from "@/features/sources/types";
import { useMetaEnter } from "@/hooks/use-meta-enter";
import { applyAPIFormError } from "@/lib/forms/apply-api-form-error";
import { zodResolver } from "@hookform/resolvers/zod";
import * as React from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";

interface CreateSectionDialogProps extends WithDialogResult<SourceSectionDTO> {
  source: SourceDTO;
  onSuccess?: (section: SourceSectionDTO) => void;
  defaultRangeStart?: number;
}

const formSchema = z.object({
  title: z.string().min(1, "Title is required"),
  subtitle: z.string().max(255, "Subtitle is too long").optional(),
  range_start: z.number().int().nonnegative().optional().or(z.literal(undefined)),
  range_end: z.number().int().nonnegative().optional().or(z.literal(undefined)),
}).refine((data) => {
  if (data.range_start !== undefined && data.range_end !== undefined) {
    return data.range_end >= data.range_start;
  }
  return true;
}, {
  message: "End must be after or equal to start",
  path: ["range_end"],
});

type FormValues = z.infer<typeof formSchema>;

export function CreateSectionDialog({
  source,
  onSuccess,
  defaultRangeStart,
}: CreateSectionDialogProps) {
  const { open, resolve } = useDialogRuntime();
  const createSection = useCreateSection(source.id!);
  const isTimeBased = source.type === "video" || source.type === "podcast";

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      subtitle: "",
      range_start: defaultRangeStart,
      range_end: undefined,
    },
  });

  // Reset form when dialog opens
  React.useEffect(() => {
    if (open) {
      form.reset({
        title: "",
        subtitle: "",
        range_start: defaultRangeStart,
        range_end: undefined,
      });
    }
  }, [open, form, defaultRangeStart]);

  async function onSubmit(data: FormValues) {
    form.clearErrors("root.server" as never);

    try {
      const newSection = await createSection.mutateAsync({
        title: data.title.trim(),
        subtitle: data.subtitle?.trim() || undefined,
        range_start: data.range_start,
        range_end: data.range_end,
      });

      toast.success("Section created successfully");
      onSuccess?.(newSection);
      resolve(newSection);
    } catch (err) {
      console.error("Failed to create section:", err);
      const message = applyAPIFormError(form, err, {
        fallbackMessage: "Unable to create section.",
      });
      toast.error(message);
    }
  }

  const handleKeyDown = useMetaEnter(() => form.handleSubmit(onSubmit)());

  return (
    <DialogForm
      title="Create Section"
      description="Organize highlights by creating sections (e.g., chapters, topics)."
      onSubmit={form.handleSubmit(onSubmit)}
      onKeyDown={handleKeyDown}
    >
      <div className="space-y-4 py-4">
        <FieldGroup>
          <Field>
            <FieldError errors={[form.formState.errors.root?.server]} />
          </Field>

          <Controller
            name="title"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="title">
                  Title <span className="text-destructive">*</span>
                </FieldLabel>
                <Input
                  {...field}
                  id="title"
                  placeholder="Chapter 1: Introduction"
                  autoFocus
                  aria-invalid={fieldState.invalid}
                />
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />

          <Controller
            name="subtitle"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="subtitle">
                  Subtitle <span className="text-xs text-muted-foreground font-normal">(optional)</span>
                </FieldLabel>
                <Input
                  {...field}
                  id="subtitle"
                  placeholder="Enter Sculley"
                  value={field.value ?? ""}
                  aria-invalid={fieldState.invalid}
                />
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />

          <div className="grid grid-cols-2 gap-4">
            <Controller
              name="range_start"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="rangeStart">
                    {isTimeBased ? "Start Timestamp (seconds)" : "Start Page"}{" "}
                    <span className="text-xs text-muted-foreground font-normal">(optional)</span>
                  </FieldLabel>
                  <Input
                    {...field}
                    id="rangeStart"
                    type="number"
                    placeholder={isTimeBased ? "0" : "1"}
                    min={0}
                    value={field.value ?? ""}
                    onChange={(e) => {
                      const value = e.target.value === "" ? undefined : parseInt(e.target.value, 10);
                      field.onChange(value);
                    }}
                    aria-invalid={fieldState.invalid}
                  />
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />

            <Controller
              name="range_end"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="rangeEnd">
                    {isTimeBased ? "End Timestamp (seconds)" : "End Page"}{" "}
                    <span className="text-xs text-muted-foreground font-normal">(optional)</span>
                  </FieldLabel>
                  <Input
                    {...field}
                    id="rangeEnd"
                    type="number"
                    placeholder={isTimeBased ? "120" : "25"}
                    min={0}
                    value={field.value ?? ""}
                    onChange={(e) => {
                      const value = e.target.value === "" ? undefined : parseInt(e.target.value, 10);
                      field.onChange(value);
                    }}
                    aria-invalid={fieldState.invalid}
                  />
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />
          </div>
        </FieldGroup>
      </div>

      <DialogFormFooter
        submitLabel="Create Section"
        pending={createSection.isPending}
      />
    </DialogForm>
  );
}
