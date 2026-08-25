import type { PdfPosition, PdfRect } from "@/features/sources/types";

/**
 * Manual location types derived from source type.
 */
export type ManualLocationType = "book" | "av" | "article" | "other";

/**
 * Location type discriminator for citation locations.
 */
export type LocationType =
  | "book_v1"
  | "av_v1"
  | "other_v1"
  | "transcript_v1"
  | "pdf_v1";

export type LocationMode = "manual" | "derived";

export interface BookLocationPayload {
  pageStart?: number;
  pageEnd?: number;
}

export interface AvLocationPayload {
  tStartSec?: number;
  tEndSec?: number;
}

export interface OtherLocationPayload {
  fallbackLabel: string;
}

/**
 * Transcript-specific location payload with utterance anchors.
 */
export interface TranscriptLocationPayload {
  utteranceStartIdx: number;
  utteranceEndIdx: number;
  charOffsetStart?: number;
  charOffsetEnd?: number;
  tStartSec?: number;
  tEndSec?: number;
}

export interface PdfLocationPayload {
  position: PdfPosition;
}

export interface CitationLocation {
  mode: LocationMode;
  type: LocationType;
  book?: BookLocationPayload;
  av?: AvLocationPayload;
  other?: OtherLocationPayload;
  transcript?: TranscriptLocationPayload;
  pdf?: PdfLocationPayload;
}

export type { PdfPosition, PdfRect };

/**
 * Maps source type to manual location field set.
 */
export function mapSourceTypeToLocationType(sourceType?: string): ManualLocationType {
  switch (sourceType) {
    case "book":
    case "pdf":
      return "book";
    case "video":
    case "podcast":
      return "av";
    case "article":
      return "article";
    default:
      return "other";
  }
}

/**
 * Converts seconds to HH:MM:SS format.
 * Handles null/undefined by returning empty string.
 */
export function secondsToHms(totalSeconds: number | null | undefined): string {
  if (totalSeconds == null || Number.isNaN(totalSeconds)) return "";
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return [hours, minutes, secs]
    .map((n) => String(n).padStart(2, "0"))
    .join(":");
}

/**
 * Parses a time string (MM:SS or HH:MM:SS) to total seconds.
 * Returns null for invalid formats.
 */
export function hmsToSeconds(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parts = trimmed.split(":");
  if (parts.length < 2 || parts.length > 3) return null;

  const [h, m, s] =
    parts.length === 3 ? parts.map((p) => Number(p)) : [0, Number(parts[0]), Number(parts[1])];

  if ([h, m, s].some((n) => Number.isNaN(n) || n < 0)) return null;

  return h * 3600 + m * 60 + s;
}

/**
 * Formats a timestamp or timestamp range for display.
 * Omits hours if duration is less than 1 hour.
 * Shows range with en-dash if start and end differ.
 */
function formatTimestamp(
  startSec: number,
  endSec?: number,
  decimalPoints?: number | null
): string {
  const formatTime = (sec: number): string => {
    const precision = decimalPoints ?? 1;
    const factor = Math.pow(10, precision);
    const rounded = Math.round(sec * factor) / factor;

    const hours = Math.floor(rounded / 3600);
    const minutes = Math.floor((rounded % 3600) / 60);
    const seconds = rounded % 60;

    let secondsStr: string;
    if (decimalPoints === 0) {
      secondsStr = String(Math.floor(seconds)).padStart(2, "0");
    } else if (decimalPoints != null) {
      const parts = seconds.toFixed(decimalPoints).split(".");
      secondsStr = parts[0].padStart(2, "0") + (parts[1] ? "." + parts[1] : "");
    } else {
      if (seconds % 1 === 0) {
        secondsStr = String(Math.floor(seconds)).padStart(2, "0");
      } else {
        const wholePart = Math.floor(seconds);
        const decimalPart = (seconds % 1).toFixed(1).slice(1);
        secondsStr = String(wholePart).padStart(2, "0") + decimalPart;
      }
    }

    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, "0")}:${secondsStr}`;
    }
    return `${minutes}:${secondsStr}`;
  };

  const start = formatTime(startSec);
  if (endSec != null && endSec !== startSec) {
    const end = formatTime(endSec);
    return `${start}–${end}`;
  }
  return start;
}

export function getLocationTimestamp(
  location: CitationLocation | null | undefined
): { startSec: number; endSec?: number } | null {
  if (!location) return null;
  if (location.type === "av_v1" && location.av?.tStartSec != null) {
    return { startSec: location.av.tStartSec, endSec: location.av.tEndSec };
  }
  if (location.type === "transcript_v1" && location.transcript?.tStartSec != null) {
    return {
      startSec: location.transcript.tStartSec,
      endSec: location.transcript.tEndSec,
    };
  }
  return null;
}

export function getLocationPageNumber(location: CitationLocation | null | undefined): number | null {
  if (!location) return null;
  if (location.type === "book_v1" && location.book?.pageStart != null) {
    return location.book.pageStart;
  }
  if (location.type === "pdf_v1" && location.pdf?.position?.pageNumber != null) {
    const rects = location.pdf.position.rects ?? [];
    if (rects.length > 0) {
      return rects.reduce((min, rect) => Math.min(min, rect.pageNumber ?? min), rects[0].pageNumber ?? location.pdf.position.pageNumber);
    }
    return location.pdf.position.pageNumber;
  }
  return null;
}

function getPdfPageRange(position: PdfPosition | null | undefined): { start: number; end: number } | null {
  if (!position) return null;
  const rects = position.rects ?? [];
  if (rects.length === 0) {
    if (position.pageNumber != null) {
      return { start: position.pageNumber, end: position.pageNumber };
    }
    return null;
  }
  let start = rects[0].pageNumber ?? position.pageNumber ?? 0;
  let end = start;
  for (const rect of rects) {
    if (rect.pageNumber == null) continue;
    if (rect.pageNumber < start) start = rect.pageNumber;
    if (rect.pageNumber > end) end = rect.pageNumber;
  }
  if (start <= 0) return null;
  return { start, end };
}

export function getPdfPosition(location: CitationLocation | null | undefined): PdfPosition | null {
  if (!location) return null;
  if (location.type === "pdf_v1" && location.pdf?.position) {
    return location.pdf.position;
  }
  return null;
}

/**
 * Formats a citation location for user-facing display.
 */
export function formatCitationLocation(location: unknown): string | null {
  if (!location || typeof location !== "object") return null;

  const loc = location as CitationLocation;

  switch (loc.type) {
    case "book_v1":
      if (loc.book?.pageStart != null) {
        if (loc.book.pageEnd != null && loc.book.pageEnd !== loc.book.pageStart) {
          return `Pages ${loc.book.pageStart}–${loc.book.pageEnd}`;
        }
        return `Page ${loc.book.pageStart}`;
      }
      break;

    case "pdf_v1":
      if (loc.pdf?.position) {
        const range = getPdfPageRange(loc.pdf.position);
        if (range) {
          if (range.start !== range.end) {
            return `Pages ${range.start}–${range.end}`;
          }
          return `Page ${range.start}`;
        }
      }
      break;

    case "av_v1":
    case "transcript_v1": {
      const timestamp = getLocationTimestamp(loc);
      if (timestamp?.startSec != null) {
        return formatTimestamp(timestamp.startSec, timestamp.endSec, 0);
      }
      break;
    }

    case "other_v1":
      if (loc.other?.fallbackLabel) {
        return loc.other.fallbackLabel;
      }
      break;
  }

  return null;
}
