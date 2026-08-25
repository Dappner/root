"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "@/lib/nav";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";

import {
  DialogForm,
  DialogFormFooter,
  clearDialogFailureCache,
  isDialogFailureCacheEnabled,
  readDialogFailureCache,
  useDialogRuntime,
  WithDialogResult,
} from "@/components/dialogs";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useCreateSource, useEnrichSource } from "@/features/sources/hooks/sources";
import { useAddVideoToLibrary, useImportVideo } from "@/features/videos/hooks";
import { isYouTubeUrl } from "@/features/videos/utils/youtube";
import type { VideoDTO } from "@/features/videos/types";
import { APIError } from "@/lib/fetchers/api-fetcher";
import { routes } from "@/lib/routes";
import { applyAPIFormError } from "@/lib/forms/apply-api-form-error";
import type { EnrichSourceResponse } from "@/features/sources/types";
import {
  getTypeConfig,
  sanitizeMetadataByType,
  type SourceType,
} from "@/features/sources/utils/metadata";
import { useMetaEnter } from "@/hooks/use-meta-enter";
import { toast } from "sonner";
import { MetadataFields } from "./components/metadata-fields";
import { TypeSelector } from "./components/type-selector";
import { UrlFetchField } from "./components/url-fetch-field";
import { YouTubeConfirmation } from "./components/youtube-confirmation";
import { CreateSourceFormData, createSourceFormSchema } from "./schema";

const YOUTUBE_IMPORT_DEBOUNCE_MS = 400;

interface CreateSourceDialogProps extends WithDialogResult<number> {
  defaultType?: SourceType;
  redirectOnCreate?: boolean;
}

const FAILURE_CACHE_KEY = "create-source";

export function CreateSourceDialog({
  defaultType,
  redirectOnCreate = true,
}: CreateSourceDialogProps) {
  const router = useRouter();
  const { open, resolve } = useDialogRuntime();
  const [fetchedMetadata, setFetchedMetadata] = useState<EnrichSourceResponse | null>(null);
  const [importedVideo, setImportedVideo] = useState<VideoDTO | null>(null);
  const createSource = useCreateSource();
  const enrichSource = useEnrichSource();
  const importVideo = useImportVideo();
  const addVideoToLibrary = useAddVideoToLibrary();

  const form = useForm<CreateSourceFormData>({
    resolver: zodResolver(createSourceFormSchema),
    defaultValues: {
      type: defaultType || "book",
      title: "",
      author: "",
      url: "",
      published_at: "",
      metadata: {},
    },
  });

  useEffect(() => {
    if (!open || !isDialogFailureCacheEnabled()) {
      return;
    }
    const cachedValues = readDialogFailureCache<CreateSourceFormData>(FAILURE_CACHE_KEY);
    if (cachedValues) {
      form.reset({
        ...form.getValues(),
        ...cachedValues,
      });
      clearDialogFailureCache(FAILURE_CACHE_KEY);
    }
  }, [open, form]);

  const { watch, control, clearErrors, setValue, formState: { errors } } = form;

  const currentType = watch("type");
  const currentUrl = watch("url");
  const currentTitle = watch("title");

  // A pasted YouTube URL auto-resolves into a confirmation card — no Fetch
  // button, no manual title/channel entry. Detection drives both the type
  // (auto-switch to "video") and the collapsed UI.
  const isYouTube = isYouTubeUrl(currentUrl ?? "");

  useEffect(() => {
    clearErrors(["title", "root.server" as never]);
  }, [currentTitle, currentType, clearErrors]);

  // Auto-switch to the video type the moment a YouTube URL is recognized, so
  // the form collapses regardless of which type the user started on.
  useEffect(() => {
    if (isYouTube && currentType !== "video") {
      setValue("type", "video");
    }
  }, [isYouTube, currentType, setValue]);

  // Debounced auto-import: as soon as the URL is a recognizable YouTube link,
  // fetch its metadata without a Fetch button. Re-imports only when the URL
  // changes to a different video.
  useEffect(() => {
    if (!isYouTube) {
      if (importedVideo) setImportedVideo(null);
      return;
    }
    const url = (currentUrl ?? "").trim();
    const timer = setTimeout(() => {
      importVideo.mutate(
        { url },
        { onSuccess: (video) => setImportedVideo(video) },
      );
    }, YOUTUBE_IMPORT_DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // Re-run only when the recognized URL changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUrl, isYouTube]);

  const handleTypeChange = (newType: SourceType) => {
    setValue("type", newType);
    setValue("metadata", {});
    setValue("url", "");
    setValue("title", "");
    setValue("author", "");
    setValue("published_at", "");
    setFetchedMetadata(null);
    setImportedVideo(null);
  };

  const handleAddVideoToLibrary = async () => {
    if (!importedVideo) return;
    try {
      const source = await addVideoToLibrary.mutateAsync({
        video_id: importedVideo.id,
      });
      resolve(source.id);
      if (redirectOnCreate) {
        router.push(routes.source(source.id));
      }
    } catch (error) {
      console.error("Failed to add video to library:", error);
      toast.error("Failed to add video to library. Please try again.");
    }
  };

  const handleFetchMetadata = async () => {
    if (!currentUrl || currentUrl.trim() === "") return;

    enrichSource.mutate(currentUrl, {
      onSuccess: (data) => {
        setFetchedMetadata(data);

        if (data.title && !currentTitle) {
          setValue("title", data.title);
        }

        if (data.author_name) {
          setValue("author", data.author_name);
        }

        const currentMetadata = form.getValues("metadata") || {};
        const newMetadata: Record<string, string | number> = { ...currentMetadata };

        if (data.site_name && currentType === "article") {
          newMetadata.publication = data.site_name;
        }

        setValue("metadata", newMetadata);
      },
    });
  };

  const onSubmit = async (data: CreateSourceFormData) => {
    // YouTube sources are added via the confirmation card, not the generic
    // create-source path — ignore an accidental form submit (e.g. Enter in the
    // URL field) while in YouTube mode.
    if (isYouTube) {
      if (importedVideo && !addVideoToLibrary.isPending) {
        await handleAddVideoToLibrary();
      }
      return;
    }

    clearErrors("root.server" as never);

    try {
      const finalMetadata = { ...data.metadata };
      if (data.url) {
        finalMetadata.url = data.url;
      }
      const cleanedMetadata = sanitizeMetadataByType(data.type, finalMetadata);

      const publishedAtIso = data.published_at
        ? new Date(`${data.published_at}T00:00:00Z`).toISOString()
        : undefined;

      const source = await createSource.mutateAsync({
        title: data.title || "",
        type: data.type,
        author: data.author || undefined,
        published_at: publishedAtIso,
        metadata: cleanedMetadata,
      });

      if (source?.id) {
        clearDialogFailureCache(FAILURE_CACHE_KEY);
        resolve(source.id);
        if (redirectOnCreate) {
          router.push(routes.source(source.id));
        }
      }
    } catch (error) {
      console.error("Failed to create source:", error);

      const message = applyAPIFormError(form, error, {
        fallbackMessage: "Failed to create source.",
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
    if (isYouTube) {
      if (importedVideo && !addVideoToLibrary.isPending) {
        void handleAddVideoToLibrary();
      }
      return;
    }
    form.handleSubmit(onSubmit)();
  });

  const currentConfig = getTypeConfig(currentType);
  const needsUrl = currentConfig.requiresUrl;

  return (
    <DialogForm
      title="Add Source"
      onSubmit={form.handleSubmit(onSubmit)}
      onKeyDown={handleKeyDown}
    >
      <FieldGroup>
        <Field>
          <FieldError errors={[errors.root?.server]} />
        </Field>

        <TypeSelector
          control={control}
          currentType={currentType}
          onTypeChange={handleTypeChange}
          errors={errors}
        />

        <UrlFetchField
          control={control}
          currentType={currentType}
          currentUrl={currentUrl}
          isFetchingMetadata={enrichSource.isPending}
          onFetchMetadata={handleFetchMetadata}
          hasFetchedMetadata={!!fetchedMetadata}
          youtube={isYouTube}
        />

        {isYouTube ? (
          <YouTubeConfirmation
            isImporting={importVideo.isPending}
            importError={importVideo.error}
            video={importedVideo}
            onAddToLibrary={handleAddVideoToLibrary}
            isAdding={addVideoToLibrary.isPending}
          />
        ) : (
          <>
        <Controller
          name="title"
          control={control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="title" className="text-sm font-medium">
                Title <span className="text-destructive">*</span>
                {fetchedMetadata && (
                  <span className="text-xs text-muted-foreground font-normal ml-1">
                    (auto-filled, you can edit)
                  </span>
                )}
              </FieldLabel>
              <Input
                {...field}
                id="title"
                placeholder={
                  needsUrl && !fetchedMetadata
                    ? "Click 'Fetch' to auto-fill from URL"
                    : "Enter source title"
                }
                aria-invalid={fieldState.invalid}
              />
              {fieldState.invalid && (
                <FieldError errors={[fieldState.error]} />
              )}
            </Field>
          )}
        />

        <Controller
          name="author"
          control={control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="author" className="text-sm font-medium">
                {currentConfig.authorLabel}
                {fetchedMetadata && fetchedMetadata.author_name && (
                  <span className="text-xs text-muted-foreground font-normal ml-1">
                    (auto-filled, you can edit)
                  </span>
                )}
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

        <MetadataFields
          control={control}
          currentType={currentType}
          setValue={setValue}
        />

        <DialogFormFooter
          submitLabel="Create Source"
          pending={createSource.isPending || form.formState.isSubmitting}
        />
          </>
        )}
      </FieldGroup>
    </DialogForm>
  );
}
