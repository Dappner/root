"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

import { AutoGrowTextarea } from "@/components/forms/auto-grow-textarea";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { useMetaEnter } from "@/hooks/use-meta-enter";

const captureSchema = z.object({
  text: z.string().min(1, "Text is required"),
});

export type CaptureFormValues = z.infer<typeof captureSchema>;

interface CaptureFormProps {
  defaultValues?: Partial<CaptureFormValues>;
  onSubmit: (data: CaptureFormValues) => Promise<void>;
  onCancel: () => void;
  submitLabel?: string;
  children?: React.ReactNode;
}

export function CaptureForm({
  defaultValues,
  onSubmit,
  onCancel,
  submitLabel = "Save",
  children,
}: CaptureFormProps) {
  const form = useForm<CaptureFormValues>({
    resolver: zodResolver(captureSchema),
    defaultValues: {
      text: defaultValues?.text || "",
    },
  });

  const handleKeyDown = useMetaEnter(() => {
    form.handleSubmit(onSubmit)();
  });

  return (
    <div className="min-w-0 space-y-4">
      {children}

      <form
        id="capture-form"
        onSubmit={form.handleSubmit(onSubmit)}
        onKeyDown={handleKeyDown}
        className="space-y-4"
      >
        <FieldGroup className="gap-3">
          <Controller
            name="text"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="text">
                  Comment <span className="text-destructive">*</span>
                </FieldLabel>
                <AutoGrowTextarea
                  {...field}
                  id="text"
                  placeholder="Add a comment..."
                  minRows={3}
                  maxRows={8}
                  aria-invalid={fieldState.invalid}
                  autoFocus
                />
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />
        </FieldGroup>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={form.formState.isSubmitting}
          >
            {form.formState.isSubmitting ? "Saving..." : submitLabel}
          </Button>
        </DialogFooter>
      </form>
    </div>
  );
}
