"use client";

import type { FieldValues, Path, UseFormReturn } from "react-hook-form";

import { APIError } from "@/lib/fetchers/api-fetcher";

type FormErrorTarget<TFieldValues extends FieldValues> = Path<TFieldValues> | "root.server";

interface ApplyAPIFormErrorOptions<TFieldValues extends FieldValues> {
  fallbackMessage?: string;
  defaultField?: FormErrorTarget<TFieldValues>;
  fieldMap?: Partial<Record<string, FormErrorTarget<TFieldValues>>>;
}

export function getErrorMessage(
  error: unknown,
  fallbackMessage = "Something went wrong.",
): string {
  if (error instanceof APIError) {
    return error.problem.detail || error.problem.title || fallbackMessage;
  }

  if (error instanceof Error) {
    return error.message || fallbackMessage;
  }

  return fallbackMessage;
}

export function applyAPIFormError<TFieldValues extends FieldValues>(
  form: Pick<UseFormReturn<TFieldValues>, "setError">,
  error: unknown,
  options: ApplyAPIFormErrorOptions<TFieldValues> = {},
): string {
  const {
    fallbackMessage = "Something went wrong.",
    defaultField = "root.server",
    fieldMap,
  } = options;

  if (error instanceof APIError && error.isValidationError()) {
    let appliedFieldErrors = false;

    for (const fieldError of error.fieldErrors) {
      const target = fieldMap?.[fieldError.field] ?? fieldError.field;
      form.setError(target as FormErrorTarget<TFieldValues>, {
        type: "server",
        message: fieldError.message,
      });
      appliedFieldErrors = true;
    }

    if (appliedFieldErrors) {
      return getErrorMessage(error, fallbackMessage);
    }
  }

  const message = getErrorMessage(error, fallbackMessage);
  form.setError(defaultField as FormErrorTarget<TFieldValues>, {
    type: "server",
    message,
  });
  return message;
}
