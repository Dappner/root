"use client";

import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { FileText, Quote } from "lucide-react";
import { Control, Controller } from "react-hook-form";
import { CitationFormValues } from "../schema";

const infoTypes = [
  { value: "quote" as const, label: "Quote", icon: Quote },
  // { value: "stat" as const, label: "Stat", icon: BarChart3 },
  // { value: "fact" as const, label: "Fact", icon: Lightbulb },
  { value: "paraphrase" as const, label: "Paraphrase", icon: FileText },
] as const;

interface InfoTypeSelectorProps {
  control: Control<CitationFormValues>;
}

export function InfoTypeSelector({ control }: InfoTypeSelectorProps) {
  return (
    <Controller
      name="info_type"
      control={control}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid}>
          <FieldLabel>Type</FieldLabel>
          <RadioGroup value={field.value} onValueChange={field.onChange}>
            <div className="grid grid-cols-2 gap-1.5">
              {infoTypes.map(({ value, label, icon: Icon }) => (
                <label
                  key={value}
                  htmlFor={`info-${value}`}
                  className={`
                    flex flex-col items-center gap-1 p-1.5 border-2 rounded-lg cursor-pointer transition-all
                    ${field.value === value
                      ? "border-primary bg-primary/5"
                      : "border-muted hover:border-primary/50"
                    }
                  `}
                >
                  <RadioGroupItem
                    value={value}
                    id={`info-${value}`}
                    className="sr-only"
                  />
                  <Icon className="h-5 w-5" />
                  <span className="text-xs font-medium">{label}</span>
                </label>
              ))}
            </div>
          </RadioGroup>
          {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
        </Field>
      )}
    />
  );
}
