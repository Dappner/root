"use client";

import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { UseFormReturn } from "react-hook-form";
import { CitationFormValues } from "../schema";

interface OtherLocationFieldsProps {
  form: UseFormReturn<CitationFormValues>;
}

export function OtherLocationFields({ form }: OtherLocationFieldsProps) {
  const { register, formState: { errors } } = form;

  return (
    <Field>
      <FieldLabel htmlFor="fallback-label">Label</FieldLabel>
      <Input
        id="fallback-label"
        placeholder="e.g. Slide 5"
        {...register("fallbackLabel")}
      />
      <FieldError errors={errors.fallbackLabel ? [errors.fallbackLabel] : []} />
    </Field>
  );
}
