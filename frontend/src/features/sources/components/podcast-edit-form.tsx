"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import * as React from "react";
import { useForm, Controller } from "react-hook-form";
import * as z from "zod";
import { toast } from "sonner";
import { Mic, Clock, Calendar, User, ExternalLink } from "lucide-react";

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
import { APIError } from "@/lib/fetchers/api-fetcher";
import { applyAPIFormError } from "@/lib/forms/apply-api-form-error";
import { formatDuration, formatDateUTC } from "@/lib/utils/date";

const podcastFormSchema = z.object({
  title: z.string().min(1, "Title is required").max(500, "Title too long"),
});

type PodcastFormData = z.infer<typeof podcastFormSchema>;

interface PodcastEditFormProps {
  source: SourceDTO;
  onSuccess: () => void;
  onCancel: () => void;
}

export function PodcastEditForm({
  source,
  onSuccess,
  onCancel,
}: PodcastEditFormProps) {
  const updateSource = useUpdateSource();

  const form = useForm<PodcastFormData>({
    resolver: zodResolver(podcastFormSchema),
    defaultValues: {
      title: source.title || "",
    },
  });

  const currentTitle = form.watch("title");

  React.useEffect(() => {
    form.clearErrors(["title", "root.server" as never]);
  }, [currentTitle, form]);

  const onSubmit = async (data: PodcastFormData) => {
    form.clearErrors("root.server" as never);

    try {
      await updateSource.mutateAsync({
        id: source.id,
        data: {
          title: data.title,
        },
      });

      toast.success("Podcast updated successfully");
      onSuccess();
    } catch (error) {
      console.error("Failed to update podcast:", error);
      const message = applyAPIFormError(form, error, {
        fallbackMessage: "Failed to update podcast.",
        defaultField: error instanceof APIError && error.status === 409
          ? "title"
          : "root.server",
      });
      if (!(error instanceof APIError && error.isValidationError())) {
        toast.error(message);
      }
    }
  };

  const metadata = (source.metadata || {}) as Record<string, unknown>;
  const url = metadata.url as string | undefined;

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <FieldGroup>
        <Field>
          <FieldError errors={[form.formState.errors.root?.server]} />
        </Field>

        {/* Read-only Source Type Header */}
        <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-lg border">
          <Mic className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Podcast Episode</span>
        </div>

        {/* Title Field (Editable) */}
        <Controller
          name="title"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="title" className="text-sm font-medium">
                Title <span className="text-destructive">*</span>
              </FieldLabel>
              <Input
                {...field}
                id="title"
                placeholder="Enter podcast title"
                aria-invalid={fieldState.invalid}
              />
              {fieldState.invalid && (
                <FieldError errors={[fieldState.error]} />
              )}
            </Field>
          )}
        />

        {/* Read-only Information Section */}
        <div className="space-y-4 rounded-lg border bg-muted/30 p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Episode Details (Read-only)
          </h3>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <User className="h-3 w-3" />
                <span>Show</span>
              </div>
              <p className="text-sm font-medium">{source.author || "Unknown Show"}</p>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Mic className="h-3 w-3" />
                <span>Episode</span>
              </div>
              <p className="text-sm font-medium truncate" title={source.episode || "Unknown Episode"}>
                {source.episode || "Unknown Episode"}
              </p>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                <span>Duration</span>
              </div>
              <p className="text-sm font-medium">
                {source.duration ? formatDuration(source.duration) : "Unknown"}
              </p>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3" />
                <span>Published</span>
              </div>
              <p className="text-sm font-medium">
                {source.published_at
                  ? formatDateUTC(source.published_at, { month: 'short', day: 'numeric', year: 'numeric' })
                  : "Unknown Date"}
              </p>
            </div>

            {url && (
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <ExternalLink className="h-3 w-3" />
                  <span>Source URL</span>
                </div>
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-primary hover:underline truncate block max-w-full"
                >
                  View Original
                </a>
              </div>
            )}
          </div>
        </div>
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
          disabled={updateSource.isPending || form.formState.isSubmitting}
        >
          {updateSource.isPending || form.formState.isSubmitting ? "Saving..." : "Save Changes"}
        </Button>
      </DialogFooter>
    </form>
  );
}
