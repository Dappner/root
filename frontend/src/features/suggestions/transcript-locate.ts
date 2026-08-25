import type { TranscriptUtterance } from "@/features/podcasts/types";

/**
 * Locate the utterances a citation span covers by TIME, not by saved indices —
 * those go stale when the transcript is re-sectioned, but timestamps stay
 * authoritative. Returns the inclusive [matchStart, matchEnd] index range, or
 * { matchStart: -1 } when nothing overlaps.
 */
export function locateByTime(
  utterances: TranscriptUtterance[],
  tStart: number,
  tEnd: number,
): { matchStart: number; matchEnd: number } {
  let matchStart = -1;
  let matchEnd = -1;
  for (let i = 0; i < utterances.length; i++) {
    const u = utterances[i];
    // Overlap test: utterance [start,end] intersects the citation [tStart,tEnd].
    if (u.end >= tStart && u.start <= tEnd) {
      if (matchStart === -1) matchStart = i;
      matchEnd = i;
    } else if (matchStart !== -1 && u.start > tEnd) {
      break; // utterances are time-ordered; no further overlaps possible
    }
  }
  return { matchStart, matchEnd };
}
