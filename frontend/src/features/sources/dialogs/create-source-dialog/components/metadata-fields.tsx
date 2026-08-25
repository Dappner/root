"use client";

import * as React from "react";
import { Controller, Control, UseFormSetValue } from "react-hook-form";
import { Field, FieldError, FieldLabel, FieldGroup } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { SourceType } from "@/features/sources/types";
import { getTypeConfig } from "@/features/sources/utils/metadata";
import { CreateSourceFormData } from "../schema";

interface MetadataFieldsProps {
  control: Control<CreateSourceFormData>;
  currentType: SourceType;
  setValue: UseFormSetValue<CreateSourceFormData>;
}

export function MetadataFields({ control, currentType, setValue }: MetadataFieldsProps) {
  const [showDetails, setShowDetails] = React.useState(false);

  const handleMetadataChange = (key: string, value: string | number) => {
    setValue(`metadata.${key}`, value);
  };

  return (
    <div className="border rounded-lg">
      <button
        type="button"
        onClick={() => setShowDetails(!showDetails)}
        className="w-full flex items-center justify-between p-3 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <span>
          {showDetails ? "Hide" : "Add"} details
          <span className="ml-1 text-xs">(optional)</span>
        </span>
        {showDetails ? (
          <ChevronUp className="h-4 w-4" />
        ) : (
          <ChevronDown className="h-4 w-4" />
        )}
      </button>

      {showDetails && (
        <FieldGroup className="px-3 pb-3 border-t pt-3 space-y-3">
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
            .filter((f) => f.showInDetails !== false)
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
                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />
            ))}
        </FieldGroup>
      )}
    </div>
  );
}
