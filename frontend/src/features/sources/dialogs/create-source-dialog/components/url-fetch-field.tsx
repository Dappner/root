"use client";

import { Controller, Control } from "react-hook-form";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Sparkles } from "lucide-react";
import { CreateSourceFormData } from "../schema";
import type { SourceType } from "@/features/sources/types";
import { getTypeConfig } from "@/features/sources/utils/metadata";

interface UrlFetchFieldProps {
  control: Control<CreateSourceFormData>;
  currentType: SourceType;
  currentUrl: string | undefined;
  isFetchingMetadata: boolean;
  onFetchMetadata: () => void;
  hasFetchedMetadata: boolean;
  /** When the URL is a recognized YouTube link, auto-import takes over and the
   * Fetch button is hidden. */
  youtube?: boolean;
}

export function UrlFetchField({
  control,
  currentType,
  currentUrl,
  isFetchingMetadata,
  onFetchMetadata,
  hasFetchedMetadata,
  youtube = false,
}: UrlFetchFieldProps) {
  const currentConfig = getTypeConfig(currentType);
  const needsUrl = currentConfig.requiresUrl;
  const urlPlaceholder =
    currentConfig.metadataFields.find((f) => f.key === "url")?.placeholder ||
    "https://example.com";

  if (!needsUrl) return null;

  return (
    <Controller
      name="url"
      control={control}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid}>
          <FieldLabel htmlFor="source-url" className="text-sm font-medium">
            URL <span className="text-destructive">*</span>
          </FieldLabel>
          <div className="flex gap-2">
            <Input
              {...field}
              id="source-url"
              type="url"
              placeholder={urlPlaceholder}
              aria-invalid={fieldState.invalid}
              className="flex-1"
            />
            {!youtube && (
              <Button
                type="button"
                variant="outline"
                onClick={onFetchMetadata}
                disabled={
                  !currentUrl ||
                  currentUrl.trim() === "" ||
                  fieldState.invalid ||
                  isFetchingMetadata
                }
              >
                {isFetchingMetadata ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Fetching...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Fetch
                  </>
                )}
              </Button>
            )}
          </div>
          {fieldState.invalid && !youtube && (
            <FieldError errors={[fieldState.error]} />
          )}
          {hasFetchedMetadata && !youtube && (
            <div className="flex items-center gap-2 text-sm text-green-700">
              <div className="h-3 w-3 bg-green-500 rounded-full" />
              <span>Metadata fetched successfully</span>
            </div>
          )}
        </Field>
      )}
    />
  );
}
