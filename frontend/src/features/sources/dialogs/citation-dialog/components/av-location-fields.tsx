"use client";

import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { UseFormReturn } from "react-hook-form";
import { CitationFormValues } from "../schema";

interface AvLocationFieldsProps {
  form: UseFormReturn<CitationFormValues>;
}

export function AvLocationFields({ form }: AvLocationFieldsProps) {
  const { register, formState: { errors } } = form;

  return (
    <div className="grid grid-cols-2 gap-2">
      <Field>
        <FieldLabel htmlFor="t-start">Start (HH:MM:SS)</FieldLabel>
        <Input
          id="t-start"
          placeholder="00:01:23"
          {...register("tStart")}
        />
        <FieldError errors={errors.tStart ? [errors.tStart] : []} />
      </Field>
      <Field>
        <FieldLabel htmlFor="t-end">
          End (optional)
        </FieldLabel>
        <Input
          id="t-end"
          placeholder="00:02:10"
          {...register("tEnd")}
        />
        <FieldError errors={errors.tEnd ? [errors.tEnd] : []} />
      </Field>
    </div>
  );
}
