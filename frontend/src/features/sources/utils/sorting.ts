import type { CitationWithCapture } from "../types";
import { getLocationPageNumber, getLocationTimestamp, type CitationLocation } from "./location";

/**
 * Sorts citations by their location data (page number or timestamp).
 * Provides natural ordering for highlights within a source:
 * - Books/PDFs: Sort by page number (ascending)
 * - Audio/Video/Transcript: Sort by timestamp (ascending)
 * - Other/No location: Sort by created_at (fallback)
 *
 * @param a - First citation to compare
 * @param b - Second citation to compare
 * @returns Negative if a < b, positive if a > b, 0 if equal
 */
export function sortCitationsByLocation(
  a: CitationWithCapture,
  b: CitationWithCapture,
): number {
  const locA = a.citation.location;
  const locB = b.citation.location;

  // No location data - sort by created_at
  if (!locA && !locB) {
    return new Date(a.citation.created_at).getTime() - new Date(b.citation.created_at).getTime();
  }
  if (!locA) return 1; // Items without location go last
  if (!locB) return -1;

  const locationA = locA as CitationLocation;
  const locationB = locB as CitationLocation;

  const pdfA = locationA.type === "pdf_v1" ? locationA.pdf?.position : null;
  const pdfB = locationB.type === "pdf_v1" ? locationB.pdf?.position : null;

  if (pdfA && pdfB) {
    const pageA = pdfA.pageNumber ?? 0;
    const pageB = pdfB.pageNumber ?? 0;
    if (pageA !== pageB) return pageA - pageB;

    const rectA = pdfA.boundingRect;
    const rectB = pdfB.boundingRect;
    const yA = rectA?.y1 ?? 0;
    const yB = rectB?.y1 ?? 0;
    if (yA !== yB) return yA - yB;

    const xA = rectA?.x1 ?? 0;
    const xB = rectB?.x1 ?? 0;
    if (xA !== xB) return xA - xB;
  } else if (pdfA) {
    return -1;
  } else if (pdfB) {
    return 1;
  }

  const pageA = getLocationPageNumber(locationA);
  const pageB = getLocationPageNumber(locationB);
  if (pageA != null && pageB != null) {
    if (pageA !== pageB) return pageA - pageB;
  }

  const timestampA = getLocationTimestamp(locationA);
  const timestampB = getLocationTimestamp(locationB);
  if (timestampA?.startSec != null && timestampB?.startSec != null) {
    return timestampA.startSec - timestampB.startSec;
  }
  if (timestampA?.startSec != null) return -1;
  if (timestampB?.startSec != null) return 1;

  // Fallback: sort by created_at
  return new Date(a.citation.created_at).getTime() - new Date(b.citation.created_at).getTime();
}
