"use client";

import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { UseFormReturn } from "react-hook-form";
import { CitationFormValues } from "../schema";

interface BookLocationFieldsProps {
  form: UseFormReturn<CitationFormValues>;
}

export function BookLocationFields({ form }: BookLocationFieldsProps) {
  const { register, formState: { errors } } = form;

  return (
    <div className="grid grid-cols-2 gap-2">
      <Field>
        <FieldLabel htmlFor="page-start">Page start</FieldLabel>
        <Input
          id="page-start"
          placeholder="e.g. 42"
          inputMode="numeric"
          {...register("pageStart")}
        />
        <FieldError errors={errors.pageStart ? [errors.pageStart] : []} />
      </Field>
      <Field>
        <FieldLabel htmlFor="page-end">
          Page end <span className="text-xs text-muted-foreground">(optional)</span>
        </FieldLabel>
        <Input
          id="page-end"
          placeholder="e.g. 45"
          inputMode="numeric"
          {...register("pageEnd")}
        />
        <FieldError errors={errors.pageEnd ? [errors.pageEnd] : []} />
      </Field>
    </div>
  );
}
