import { UseFormReturn } from "react-hook-form";
import { CitationFormValues } from "./schema";
import { hmsToSeconds, type ManualLocationType, type CitationLocation } from "@/features/sources/utils/location";

export const buildLocationPayload = (
  values: CitationFormValues,
  locationType: ManualLocationType | null,
  setError: UseFormReturn<CitationFormValues>["setError"]
): CitationLocation | "error" | null => {
  if (!locationType || locationType === "article") return null;

  if (locationType === "book") {
    const hasAny = values.pageStart || values.pageEnd;
    if (!hasAny) return null;

    if (!values.pageStart) {
      setError("pageStart", { message: "Page start is required" });
      return "error";
    }

    const start = Number(values.pageStart);
    const end = values.pageEnd ? Number(values.pageEnd) : undefined;

    if (Number.isNaN(start) || start <= 0) {
      setError("pageStart", { message: "Enter a valid page number" });
      return "error";
    }
    if (end !== undefined) {
      if (Number.isNaN(end) || end <= 0) {
        setError("pageEnd", { message: "Enter a valid page number" });
        return "error";
      }
      if (end < start) {
        setError("pageEnd", { message: "End must be ≥ start" });
        return "error";
      }
    }

    const payload: CitationLocation = {
      mode: "manual",
      type: "book_v1",
      book: {
        pageStart: start,
        pageEnd: end,
      },
    };
    return payload;
  }

  if (locationType === "av") {
    const hasAny = values.tStart || values.tEnd;
    if (!hasAny) return null;

    if (!values.tStart) {
      setError("tStart", { message: "Start time is required" });
      return "error";
    }

    const startSec = hmsToSeconds(values.tStart);
    const endSec = values.tEnd ? hmsToSeconds(values.tEnd) : null;

    if (startSec == null) {
      setError("tStart", { message: "Use HH:MM:SS" });
      return "error";
    }
    if (endSec != null && endSec < startSec) {
      setError("tEnd", { message: "End must be ≥ start" });
      return "error";
    }

    return {
      mode: "manual",
      type: "av_v1",
      av: {
        tStartSec: startSec,
        tEndSec: endSec ?? undefined,
      },
    };
  }

  if (locationType === "other") {
    if (!values.fallbackLabel?.trim()) return null;
    return {
      mode: "manual",
      type: "other_v1",
      other: {
        fallbackLabel: values.fallbackLabel.trim(),
      },
    };
  }

  return null;
};
