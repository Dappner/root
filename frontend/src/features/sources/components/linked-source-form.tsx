"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Video, ExternalLink } from "lucide-react";
import * as React from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";

import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useUpdateSource } from "@/features/sources/hooks/sources";
import type { SourceDTO } from "@/features/sources/types";
import { useMetaEnter } from "@/hooks/use-meta-enter";
import { APIError } from "@/lib/fetchers/api-fetcher";
import { applyAPIFormError } from "@/lib/forms/apply-api-form-error";
import { formatTime } from "@/lib/utils";

const formSchema = z.object({
  title: z.string().min(1, "Title is required").max(500, "Title too long"),
});

type FormData = z.infer<typeof formSchema>;

interface LinkedSourceFormProps {
  source: SourceDTO;
  onSuccess: () => void;
  onCancel: () => void;
}

/**
 * Simplified edit form for sources linked to videos (or other auto-imported content).
 * Only allows editing the title - other metadata comes from the linked entity.
 */
export function LinkedSourceForm({
  source,
  onSuccess,
  onCancel,
}: LinkedSourceFormProps) {
  const updateSource = useUpdateSource();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: source.title || "",
    },
  });

  const { control, clearErrors, watch, formState: { errors } } = form;
  const currentTitle = watch("title");

  React.useEffect(() => {
    clearErrors(["title", "root.server" as never]);
  }, [currentTitle, clearErrors]);

  const onSubmit = async (data: FormData) => {
    clearErrors("root.server" as never);

    try {
      await updateSource.mutateAsync({
        id: source.id!,
        data: {
          title: data.title,
        },
      });

      toast.success("Source updated successfully");
      onSuccess();
    } catch (error) {
      console.error("Failed to update source:", error);
      const message = applyAPIFormError(form, error, {
        fallbackMessage: "Failed to update source.",
        defaultField: error instanceof APIError && error.status === 409
          ? "title"
          : "root.server",
      });
      if (!(error instanceof APIError && error.isValidationError())) {
        toast.error(message);
      }
    }
  };

  const handleKeyDown = useMetaEnter(() => {
    form.handleSubmit(onSubmit)();
  });

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} onKeyDown={handleKeyDown}>
      <FieldGroup>
        <Field>
          <FieldError errors={[errors.root?.server]} />
        </Field>

        {/* Source Type Badge */}
        <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-lg border">
          <Video className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium capitalize">{source.type}</span>
          <span className="text-xs text-muted-foreground ml-auto">
            Linked to imported video
          </span>
        </div>

        {/* Title Field - Editable */}
        <Controller
          name="title"
          control={control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="title" className="text-sm font-medium">
                Title <span className="text-destructive">*</span>
              </FieldLabel>
              <Input
                {...field}
                id="title"
                placeholder="Enter source title"
                aria-invalid={fieldState.invalid}
              />
              {fieldState.invalid && (
                <FieldError errors={[fieldState.error]} />
              )}
            </Field>
          )}
        />

        {/* Read-only metadata from linked video */}
        <div className="space-y-3 p-3 bg-muted/30 rounded-lg border">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Video Details (read-only)
          </p>

          <div className="grid grid-cols-2 gap-3 text-sm">
            {source.author && (
              <div>
                <span className="text-muted-foreground">Channel:</span>
                <p className="font-medium truncate">{source.author}</p>
              </div>
            )}

            {source.duration && (
              <div>
                <span className="text-muted-foreground">Duration:</span>
                <p className="font-medium">{formatTime(source.duration)}</p>
              </div>
            )}

            {source.published_at && (
              <div>
                <span className="text-muted-foreground">Published:</span>
                <p className="font-medium">
                  {new Date(source.published_at).toLocaleDateString()}
                </p>
              </div>
            )}
          </div>

          {source.source_url && (
            <a
              href={source.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              View on YouTube
            </a>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={updateSource.isPending || form.formState.isSubmitting}
          >
            {updateSource.isPending || form.formState.isSubmitting
              ? "Saving..."
              : "Save Changes"}
          </Button>
        </DialogFooter>
      </FieldGroup>
    </form>
  );
}
