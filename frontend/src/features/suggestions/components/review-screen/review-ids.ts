/**
 * Synthetic citation/capture id namespacing for review mode.
 *
 * Pending suggestions carry no DB ids, and the transcript renderer keys marks /
 * hover / scroll on a single numeric `data-citation-id`. When ALL of a source's
 * ready suggestions render at once, their per-payload indices (each starting at
 * 0) would collide — so every suggestion gets an id BASE and items are offset
 * within it. The scheme is fully invertible back to {suggestionIndex, kind,
 * payloadIndex} so a click/scroll target maps to the right draft.
 *
 * Layout per suggestion (base = suggestionIndex × SUGGESTION_ID_STRIDE):
 *   citation i → base + i
 *   capture  i → base + CAPTURE_ID_OFFSET + i
 */

/** Max ids reserved per suggestion. Must exceed CAPTURE_ID_OFFSET + max captures. */
export const SUGGESTION_ID_STRIDE = 1_000_000;
/** Offset separating captures from citations within one suggestion's id space. */
export const CAPTURE_ID_OFFSET = 100_000;

export interface DecodedReviewId {
  suggestionIndex: number;
  kind: "citation" | "capture";
  payloadIndex: number;
}

// All ids are offset by 1 so none is ever 0 — the transcript renderer guards
// marks with a truthy `citationId` check, which would silently drop id 0.
const ID_BASE = 1;

export function citationReviewId(suggestionIndex: number, payloadIndex: number): number {
  return ID_BASE + suggestionIndex * SUGGESTION_ID_STRIDE + payloadIndex;
}

export function captureReviewId(suggestionIndex: number, payloadIndex: number): number {
  return ID_BASE + suggestionIndex * SUGGESTION_ID_STRIDE + CAPTURE_ID_OFFSET + payloadIndex;
}

/** Invert a synthetic review id back to its suggestion + item coordinates. */
export function decodeReviewId(id: number): DecodedReviewId {
  const base = id - ID_BASE;
  const suggestionIndex = Math.floor(base / SUGGESTION_ID_STRIDE);
  const within = base - suggestionIndex * SUGGESTION_ID_STRIDE;
  if (within >= CAPTURE_ID_OFFSET) {
    return { suggestionIndex, kind: "capture", payloadIndex: within - CAPTURE_ID_OFFSET };
  }
  return { suggestionIndex, kind: "citation", payloadIndex: within };
}
