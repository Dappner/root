"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { FileText } from "lucide-react";
import * as React from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";

import { DurationInput } from "@/components/forms/duration-input";
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
import {
  getTypeConfig,
  sanitizeMetadataByType,
  type SourceType,
} from "@/features/sources/utils/metadata";
import { sourceTypes } from "@/features/sources/utils/source-type-meta";
import { useMetaEnter } from "@/hooks/use-meta-enter";
import { APIError } from "@/lib/fetchers/api-fetcher";
import { applyAPIFormError } from "@/lib/forms/apply-api-form-error";

const formSchema = z.object({
  type: z.enum(["book", "article", "video", "podcast", "pdf"]),
  title: z.string().min(1, "Title is required").max(500, "Title too long"),
  author: z.string().max(255).optional().or(z.literal("")),
  url: z.url("Invalid URL").optional().or(z.literal("")),
  published_at: z.string().optional().or(z.literal("")),
  metadata: z.record(z.string(), z.any()).optional(),
});

type FormData = z.infer<typeof formSchema>;

interface GenericSourceFormProps {
  source: SourceDTO;
  onSuccess: () => void;
  onCancel: () => void;
}

// Helper to extract metadata from source
function extractMetadata(source: SourceDTO): Record<string, unknown> {
  try {
    if (!source.metadata) return {};
    const parsed = typeof source.metadata === 'string'
      ? JSON.parse(source.metadata)
      : source.metadata;
    return parsed || {};
  } catch {
    return {};
  }
}

export function GenericSourceForm({
  source,
  onSuccess,
  onCancel,
}: GenericSourceFormProps) {
  const updateSource = useUpdateSource();

  // Extract metadata from source
  const sourceMetadata = extractMetadata(source);
  const initialUrl = sourceMetadata.url as string | undefined;

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      type: source.type as SourceType,
      title: source.title || undefined,
      author: source.author || "",
      url: initialUrl || "",
      published_at: source.published_at ? source.published_at.slice(0, 10) : "",
      metadata: sourceMetadata,
    },
  });

  const { watch, control, clearErrors, setValue, formState: { errors } } = form;
  const currentType = watch("type");

  const currentTitle = watch("title");
  const currentUrl = watch("url");

  React.useEffect(() => {
    clearErrors(["title", "url", "published_at", "root.server" as never]);
  }, [currentTitle, currentType, currentUrl, clearErrors]);

  const handleMetadataChange = (key: string, value: string | number) => {
    setValue(`metadata.${key}`, value);
  };

  const onSubmit = async (data: FormData) => {
    clearErrors("root.server" as never);

    try {
      const finalMetadata = { ...data.metadata };
      if (data.url) {
        finalMetadata.url = data.url;
      }
      const cleanedMetadata = sanitizeMetadataByType(data.type, finalMetadata);

      await updateSource.mutateAsync({
        id: source.id!,
        data: {
          title: data.title,
          type: data.type,
          author: data.author || undefined,
          published_at: data.published_at ? `${data.published_at}T00:00:00Z` : undefined,
          metadata: cleanedMetadata,
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

  const currentConfig = getTypeConfig(currentType);
  const needsUrl = currentConfig.requiresUrl;
  const CurrentIcon = sourceTypes.find(t => t.value === currentType)?.icon || FileText;

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} onKeyDown={handleKeyDown}>
      <FieldGroup>
        <Field>
          <FieldError errors={[errors.root?.server]} />
        </Field>

        {/* Source Type (Read-only) */}
        <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-lg border">
          <CurrentIcon className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium capitalize">{currentType}</span>
        </div>

        {/* URL Field (shown first for enrichable types) */}
        {needsUrl && (
          <Controller
            name="url"
            control={control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="source-url" className="text-sm font-medium">
                  URL
                </FieldLabel>
                <Input
                  {...field}
                  id="source-url"
                  type="url"
                  placeholder={
                    getTypeConfig(currentType).metadataFields.find((f) => f.key === "url")?.placeholder ||
                    "https://example.com"
                  }
                  aria-invalid={fieldState.invalid}
                />
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />
        )}

        {/* Title Field */}
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

        {/* Author Field */}
        <Controller
          name="author"
          control={control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="author" className="text-sm font-medium">
                {currentConfig.authorLabel}
              </FieldLabel>
              <Input
                {...field}
                id="author"
                placeholder={currentConfig.authorPlaceholder}
                aria-invalid={fieldState.invalid}
              />
              {fieldState.invalid && (
                <FieldError errors={[fieldState.error]} />
              )}
            </Field>
          )}
        />

        <Controller
          name="published_at"
          control={control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="published_at" className="text-sm text-muted-foreground">
                Published date
              </FieldLabel>
              <Input
                {...field}
                id="published_at"
                type="date"
                value={field.value || ""}
                onChange={(e) => {
                  field.onChange(e.target.value);
                }}
                className="h-9"
                aria-invalid={fieldState.invalid}
              />
              {fieldState.invalid && (
                <FieldError errors={[fieldState.error]} />
              )}
            </Field>
          )}
        />
        {getTypeConfig(currentType).metadataFields
          .filter(f => f.showInDetails !== false)
          .map(({ key, label, type: inputType, placeholder }) => (
            <Controller
              key={key}
              name={`metadata.${key}`}
              control={control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={key} className="text-sm text-muted-foreground">
                    {label}
                  </FieldLabel>
                  {inputType === "duration" ? (
                    <DurationInput
                      id={key}
                      value={typeof field.value === "number" ? field.value : 0}
                      onChange={(seconds) => {
                        handleMetadataChange(key, seconds);
                        field.onChange(seconds);
                      }}
                      aria-invalid={fieldState.invalid}
                    />
                  ) : (
                    <Input
                      {...field}
                      id={key}
                      type={
                        inputType === "number"
                          ? "number"
                          : inputType === "date"
                            ? "date"
                            : inputType === "url"
                              ? "url"
                              : "text"
                      }
                      value={field.value !== undefined && field.value !== null ? field.value : ""}
                      onChange={(e) => {
                        const value =
                          inputType === "number"
                            ? e.target.value
                              ? parseInt(e.target.value)
                              : ""
                            : e.target.value;
                        handleMetadataChange(key, value as string | number);
                        field.onChange(value);
                      }}
                      placeholder={placeholder}
                      className="h-9"
                      aria-invalid={fieldState.invalid}
                    />
                  )}
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />
          ))}

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
            disabled={
              updateSource.isPending || form.formState.isSubmitting
            }
          >
            {updateSource.isPending || form.formState.isSubmitting ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </FieldGroup>
    </form>
  );
}
