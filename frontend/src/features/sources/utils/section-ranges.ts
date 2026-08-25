import type { SourceDTO } from "@/features/sources/types";

/**
 * Returns the appropriate label for a range start/end based on the source type.
 * e.g., "Start Page" vs "Start Timestamp (seconds)"
 */
export function getSectionRangeLabel(
  type: string | undefined,
  field: "start" | "end"
): string {
  const isTimeBased = type === "video" || type === "podcast";
  const label = field === "start" ? "Start" : "End";
  const suffix = isTimeBased ? "Timestamp (seconds)" : "Page";
  return `${label} ${suffix}`;
}

/**
 * Returns a human-readable range string based on the source type.
 * Formats pages for books/articles, timestamps for videos/podcasts.
 *
 * Examples:
 * - Book: "Pages 10-20" or "Page 10+"
 * - Video: "1:23 - 2:45" or "1:23+"
 *
 * @param source - Source to determine formatting type
 * @param start - Start page or timestamp (seconds)
 * @param end - End page or timestamp (seconds)
 * @returns Formatted range string, or null if no range data
 */
export function formatSectionRange(
  source: SourceDTO | undefined,
  start?: number | null,
  end?: number | null
): string | null {
  if (start == null && end == null) return null;

  const type = source?.type;
  const isTimeBased = type === "video" || type === "podcast";

  if (isTimeBased) {
    // For now, just simplistic formatting. Could use the nice H:MM:SS formatter if desired.
    const formatTime = (sec: number) => {
        const h = Math.floor(sec / 3600);
        const m = Math.floor((sec % 3600) / 60);
        const s = sec % 60;
        if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        return `${m}:${s.toString().padStart(2, '0')}`;
    }

    if (start != null && end != null) {
      return `${formatTime(start)} - ${formatTime(end)}`;
    }
    if (start != null) return `${formatTime(start)}+`;
    if (end != null) return `Until ${formatTime(end)}`;
    return null;
  }

  // Book/Article/Default
  if (start != null && end != null) {
    if (start === end) return `Page ${start}`;
    return `Pages ${start}-${end}`;
  }
  if (start != null) return `Page ${start}+`;
  if (end != null) return `Until page ${end}`;

  return null;
}
