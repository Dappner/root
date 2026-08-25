"use client";

import { Controller, Control, FieldErrors } from "react-hook-form";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import type { SourceType } from "@/features/sources/types";
import { sourceTypes } from "@/features/sources/utils/source-type-meta";
import { CreateSourceFormData } from "../schema";

interface TypeSelectorProps {
  control: Control<CreateSourceFormData>;
  currentType: SourceType;
  onTypeChange: (newType: SourceType) => void;
  errors: FieldErrors<CreateSourceFormData>;
}

export function TypeSelector({ control, currentType, onTypeChange, errors }: TypeSelectorProps) {
  return (
    <Field>
      <FieldLabel className="text-sm font-medium">Type</FieldLabel>
      <Controller
        name="type"
        control={control}
        render={({ field }) => {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { onChange, ...fieldProps } = field;
          return (
            <RadioGroup
              {...fieldProps}
              onValueChange={(val) => onTypeChange(val as SourceType)}
              value={field.value}
            >
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {sourceTypes
                  .filter(({ value }) => value !== "podcast")
                  .map(({ value, label, icon: Icon }) => (
                  <label
                    key={value}
                    htmlFor={`type-${value}`}
                    className={`
                      flex flex-col items-center gap-1.5 p-3 border-2 rounded-lg cursor-pointer transition-all
                      ${currentType === value
                        ? "border-primary bg-primary/5"
                        : "border-muted hover:border-primary/50"
                      }
                    `}
                  >
                    <RadioGroupItem
                      value={value}
                      id={`type-${value}`}
                      className="sr-only"
                    />
                    <Icon className="h-5 w-5" />
                    <span className="text-xs font-medium">{label}</span>
                  </label>
                ))}
              </div>
            </RadioGroup>
          );
        }}
      />
      {errors.type && <FieldError>{errors.type.message}</FieldError>}
    </Field>
  );
}
