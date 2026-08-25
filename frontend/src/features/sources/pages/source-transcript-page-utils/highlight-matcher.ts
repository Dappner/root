import type {
  AvLocationPayload,
  CitationLocation,
  TranscriptLocationPayload,
} from "@/features/sources/utils/location";

/**
 * Represents a transcript utterance (from podcast or video transcript).
 */
interface TranscriptUtterance {
  text: string;
  start: number; // seconds
  end: number; // seconds
  confidence?: number | null;
  speaker?: string | null;
}

/**
 * Result of finding a highlight position in the transcript.
 */
export interface HighlightMatch {
  /** Starting utterance index */
  startUtteranceIdx: number;
  /** Ending utterance index */
  endUtteranceIdx: number;
  /** Character offset within starting utterance */
  charOffsetStart: number;
  /** Character offset within ending utterance */
  charOffsetEnd: number;
  /** Confidence level of the match */
  confidence: "exact" | "time-based" | "fuzzy" | "not-found";
}

/**
 * Union type for location that could be either transcript or legacy av.
 */
type AnyLocation = CitationLocation | { type?: string; [key: string]: unknown };

/**
 * Normalizes text for fuzzy matching by lowercasing and normalizing whitespace/punctuation.
 */
function normalizeForMatching(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[']/g, "'")  // Match single quote (remove duplicate)
    .replace(/["]/g, '"')  // Match double quote (remove duplicate)
    .trim();
}

/**
 * Finds text within a specific utterance range.
 * Returns character positions if found.
 */
function findTextInUtteranceRange(
  text: string,
  utterances: TranscriptUtterance[],
  startIdx: number,
  endIdx: number,
): { charStart: number; charEnd: number; startUtteranceIdx: number } | null {
  // Build combined text from utterance range
  const rangeUtterances = utterances.slice(startIdx, endIdx + 1);
  const combinedText = rangeUtterances.map((u) => u.text).join(" ");

  // Try exact match first
  let index = combinedText.indexOf(text);

  // If no exact match, try normalized matching
  if (index === -1) {
    const normalizedCombined = normalizeForMatching(combinedText);
    const normalizedText = normalizeForMatching(text);
    index = normalizedCombined.indexOf(normalizedText);

    if (index === -1) {
      return null;
    }
  }

  // Find which utterance contains the start of the match
  let charCount = 0;
  for (let i = 0; i < rangeUtterances.length; i++) {
    const utteranceText = rangeUtterances[i].text;
    if (index < charCount + utteranceText.length) {
      return {
        charStart: index - charCount,
        charEnd: index - charCount + text.length,
        startUtteranceIdx: startIdx + i,
      };
    }
    charCount += utteranceText.length + 1; // +1 for space
  }

  return null;
}

/**
 * Attempts exact match using utterance indices and character offsets.
 * This is the most precise matching method.
 *
 * Note: For transcript highlights, we treat indices/offsets as authoritative
 * and do NOT validate against citation text. If these anchors are missing
 * or out of bounds, we fall back to time/fuzzy matching.
 */
function tryExactMatch(
  location: TranscriptLocationPayload,
  utterances: TranscriptUtterance[],
): Omit<HighlightMatch, "confidence"> | null {
  const { utteranceStartIdx, utteranceEndIdx, charOffsetStart, charOffsetEnd } =
    location;

  if (
    utteranceStartIdx === undefined ||
    utteranceEndIdx === undefined ||
    charOffsetStart === undefined ||
    charOffsetEnd === undefined
  ) {
    return null;
  }

  // Validate indices are in bounds
  if (
    utteranceStartIdx < 0 ||
    utteranceEndIdx >= utterances.length ||
    utteranceStartIdx > utteranceEndIdx
  ) {
    return null;
  }

  return {
    startUtteranceIdx: utteranceStartIdx,
    endUtteranceIdx: utteranceEndIdx,
    charOffsetStart,
    charOffsetEnd,
  };
}

/**
 * Attempts time-based match by finding the citation text within a time window.
 */
function tryTimeWindowMatch(
  location: TranscriptLocationPayload | AvLocationPayload,
  citationText: string,
  utterances: TranscriptUtterance[],
): Omit<HighlightMatch, "confidence"> | null {
  const { tStartSec, tEndSec } = location;

  if (tStartSec === undefined) {
    return null;
  }

  const effectiveEndSec = tEndSec ?? tStartSec;

  // Find utterances that overlap with the time window (with some tolerance)
  const tolerance = 5; // seconds
  const windowStart = tStartSec - tolerance;
  const windowEnd = effectiveEndSec + tolerance;

  let startIdx = -1;
  let endIdx = -1;

  for (let i = 0; i < utterances.length; i++) {
    const u = utterances[i];
    // Check if utterance overlaps with time window
    if (u.end >= windowStart && u.start <= windowEnd) {
      if (startIdx === -1) {
        startIdx = i;
      }
      endIdx = i;
    }
  }

  if (startIdx === -1 || endIdx === -1) {
    return null;
  }

  // Search for the text within this utterance range
  const match = findTextInUtteranceRange(
    citationText,
    utterances,
    startIdx,
    endIdx,
  );

  if (!match) {
    return null;
  }

  // Calculate proper end position
  const textInStartUtterance = utterances[match.startUtteranceIdx].text;
  let endUtteranceIdx = match.startUtteranceIdx;
  let charOffsetEnd = match.charEnd;

  // If text spans multiple utterances, find the end
  if (match.charEnd > textInStartUtterance.length) {
    let remaining =
      citationText.length - (textInStartUtterance.length - match.charStart);
    for (let i = match.startUtteranceIdx + 1; i <= endIdx && remaining > 0; i++) {
      const utteranceText = utterances[i].text;
      remaining -= utteranceText.length + 1; // +1 for space
      if (remaining <= 0) {
        endUtteranceIdx = i;
        charOffsetEnd = utteranceText.length + remaining; // remaining is negative
        break;
      }
    }
  }

  return {
    startUtteranceIdx: match.startUtteranceIdx,
    endUtteranceIdx,
    charOffsetStart: match.charStart,
    charOffsetEnd: Math.max(0, charOffsetEnd),
  };
}

/**
 * Attempts context-based fuzzy match using surrounding text.
 */
/**
 * Converts a character index in the full transcript to utterance positions.
 */
function findPositionFromCharIndex(
  charIndex: number,
  length: number,
  utterances: TranscriptUtterance[],
): Omit<HighlightMatch, "confidence"> | null {
  let currentChar = 0;
  let startUtteranceIdx = -1;
  let charOffsetStart = 0;
  let endUtteranceIdx = -1;
  let charOffsetEnd = 0;

  for (let i = 0; i < utterances.length; i++) {
    const text = utterances[i].text;
    const utteranceEnd = currentChar + text.length;

    // Find start position
    if (startUtteranceIdx === -1 && charIndex < utteranceEnd) {
      startUtteranceIdx = i;
      charOffsetStart = charIndex - currentChar;
    }

    // Find end position
    const endCharIndex = charIndex + length;
    if (startUtteranceIdx !== -1 && endCharIndex <= utteranceEnd) {
      endUtteranceIdx = i;
      charOffsetEnd = endCharIndex - currentChar;
      break;
    }

    currentChar = utteranceEnd + 1; // +1 for space between utterances
  }

  if (startUtteranceIdx === -1 || endUtteranceIdx === -1) {
    return null;
  }

  return {
    startUtteranceIdx,
    endUtteranceIdx,
    charOffsetStart,
    charOffsetEnd,
  };
}

/**
 * Finds the highlight position for a citation in the transcript.
 * Uses cascading fallback: exact → time-based → fuzzy → not-found.
 *
 * @param location - Citation location (transcript or legacy av)
 * @param citationText - The text of the citation to highlight
 * @param utterances - Array of transcript utterances
 * @returns HighlightMatch with position and confidence level
 */
export function findHighlightPosition(
  location: AnyLocation | null | undefined,
  citationText: string,
  utterances: TranscriptUtterance[],
): HighlightMatch {
  const notFound: HighlightMatch = {
    startUtteranceIdx: -1,
    endUtteranceIdx: -1,
    charOffsetStart: 0,
    charOffsetEnd: 0,
    confidence: "not-found",
  };

  if (!location || !citationText || utterances.length === 0) {
    return notFound;
  }

  const locationType = location.type;

  // Handle transcript type with full anchors
  if (locationType === "transcript_v1") {
    const transcriptLoc = (location as CitationLocation).transcript;
    if (!transcriptLoc) return notFound;

    // 1. Try exact match using utterance indices + char offsets
    const exactMatch = tryExactMatch(transcriptLoc, utterances);
    if (exactMatch) {
      return { ...exactMatch, confidence: "exact" };
    }

    // 2. Try time-based match
    const timeMatch = tryTimeWindowMatch(
      transcriptLoc,
      citationText,
      utterances,
    );
    if (timeMatch) {
      return { ...timeMatch, confidence: "time-based" };
    }
  }

  // Handle legacy av type (only has time data)
  if (locationType === "av_v1") {
    const avLoc = (location as CitationLocation).av;
    if (!avLoc) return notFound;
    const timeMatch = tryTimeWindowMatch(avLoc, citationText, utterances);
    if (timeMatch) {
      return { ...timeMatch, confidence: "time-based" };
    }
  }

  // Last resort: search entire transcript for the text
  const fullText = utterances.map((u) => u.text).join(" ");
  const normalizedFull = normalizeForMatching(fullText);
  const normalizedCitation = normalizeForMatching(citationText);
  const index = normalizedFull.indexOf(normalizedCitation);

  if (index !== -1) {
    const match = findPositionFromCharIndex(
      index,
      normalizedCitation.length,
      utterances,
    );
    if (match) {
      return { ...match, confidence: "fuzzy" };
    }
  }

  return notFound;
}

/**
 * Checks if a highlight match was successful.
 */
export function isMatchFound(match: HighlightMatch): boolean {
  return match.confidence !== "not-found" && match.startUtteranceIdx >= 0;
}
