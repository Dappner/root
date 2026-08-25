"use client";

import { FieldLabel } from "@/components/ui/field";
import { useSources } from "@/features/sources/hooks/sources";
import { mapSourceTypeToLocationType, type ManualLocationType } from "@/features/sources/utils/location";
import { UseFormReturn } from "react-hook-form";
import { CitationFormValues } from "../schema";
import { AvLocationFields } from "./av-location-fields";
import { BookLocationFields } from "./book-location-fields";
import { OtherLocationFields } from "./other-location-fields";

interface LocationFieldsProps {
  form: UseFormReturn<CitationFormValues>;
}

export function LocationFields({ form }: LocationFieldsProps) {
  const selectedSourceId = form.watch("source_id");
  const { data: sourcesList } = useSources();
  const sources = sourcesList?.sources;
  const selectedSource = sources?.find((s) => s.id === selectedSourceId);

  const locationType: ManualLocationType | null = selectedSource
    ? mapSourceTypeToLocationType(selectedSource.type)
    : null;

  // Don't show location fields for:
  // - No source selected
  // - Articles (no location concept)
  if (!selectedSource || locationType === "article") {
    return null;
  }

  return (
    <div className="space-y-2">
      <FieldLabel>Location (optional)</FieldLabel>

      {locationType === "book" && <BookLocationFields form={form} />}
      {locationType === "av" && <AvLocationFields form={form} />}
      {locationType === "other" && <OtherLocationFields form={form} />}
    </div>
  );
}
