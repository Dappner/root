import { useMemo } from "react";
import type {
  CaptureDTO,
  CitationResponse as CitationDTO,
} from "@/lib/api/rag-generated";
import type { TranscriptData, TranscriptUtterance } from "@/lib/api/rag-generated";

export { sourcesKeys } from "./query-keys";
export {
  useSource,
  useSourceCaptures,
  useSourceCitations,
  useSourceSections,
  useSources,
  useSourceTakeaways,
} from "./queries";
export { useUpdateSourceStatus } from "./mutations";

export type CitationWithCapture = {
  citation: CitationDTO;
  captures: CaptureDTO[];
  startsHighlight: boolean;
  // Character offsets within the utterance this entry is grouped under.
  charOffsetStart: number;
  charOffsetEnd: number;
};

type HighlightMatch = {
  startUtteranceIdx: number;
  endUtteranceIdx: number;
  charOffsetStart: number;
  charOffsetEnd: number;
};

function normalizeText(t: string) {
  return t.toLowerCase().replace(/\s+/g, " ").replace(/['''‘’]/g, "'").replace(/["""“”]/g, '"').trim();
}

function findTextInRange(
  citationText: string,
  utterances: TranscriptUtterance[],
  startIdx: number,
  endIdx: number,
): { charStart: number; startUtteranceIdx: number } | null {
  const sliced = utterances.slice(startIdx, endIdx + 1);
  const combined = sliced.map((u) => u.text).join(" ");

  let idx = combined.indexOf(citationText);
  if (idx === -1) {
    const normCombined = normalizeText(combined);
    const normText = normalizeText(citationText);
    idx = normCombined.indexOf(normText);
    if (idx === -1) return null;
  }

  let charCount = 0;
  for (let i = 0; i < sliced.length; i++) {
    if (idx < charCount + sliced[i].text.length) {
      return { charStart: idx - charCount, startUtteranceIdx: startIdx + i };
    }
    charCount += sliced[i].text.length + 1;
  }
  return null;
}

function matchCitation(
  cit: CitationDTO,
  utterances: TranscriptUtterance[],
  normFull: string,
): HighlightMatch | null {
  const loc = cit.location;
  if (!loc) return null;

  if (loc.type === "transcript_v1" && loc.transcript) {
    const { utteranceStartIdx, utteranceEndIdx, charOffsetStart, charOffsetEnd } = loc.transcript;
    if (
      utteranceStartIdx != null &&
      utteranceEndIdx != null &&
      charOffsetStart != null &&
      charOffsetEnd != null &&
      utteranceStartIdx >= 0 &&
      utteranceEndIdx >= utteranceStartIdx &&
      utteranceEndIdx < utterances.length
    ) {
      return { startUtteranceIdx: utteranceStartIdx, endUtteranceIdx: utteranceEndIdx, charOffsetStart, charOffsetEnd };
    }

    const tStart = loc.transcript.tStartSec;
    const tEnd = loc.transcript.tEndSec ?? tStart;
    if (tStart != null) {
      return timeWindowMatch(cit.text, utterances, tStart, tEnd!);
    }
  }

  if (loc.type === "av_v1" && loc.av) {
    const tStart = loc.av.tStartSec;
    const tEnd = loc.av.tEndSec ?? tStart;
    if (tStart != null) {
      return timeWindowMatch(cit.text, utterances, tStart, tEnd!);
    }
  }

  return fuzzyMatch(cit.text, utterances, normFull);
}

function timeWindowMatch(
  citationText: string,
  utterances: TranscriptUtterance[],
  tStart: number,
  tEnd: number,
): HighlightMatch | null {
  const tolerance = 5;
  const windowStart = tStart - tolerance;
  const windowEnd = tEnd + tolerance;

  let startIdx = -1;
  let endIdx = -1;
  for (let i = 0; i < utterances.length; i++) {
    const u = utterances[i];
    if (u.end >= windowStart && u.start <= windowEnd) {
      if (startIdx === -1) startIdx = i;
      endIdx = i;
    }
  }
  if (startIdx === -1) return null;

  const found = findTextInRange(citationText, utterances, startIdx, endIdx);
  if (!found) return null;
  return resolveSpanningMatch(found.startUtteranceIdx, found.charStart, citationText.length, utterances, endIdx);
}

function resolveSpanningMatch(
  startUtteranceIdx: number,
  charOffsetStart: number,
  textLength: number,
  utterances: TranscriptUtterance[],
  maxEndIdx = utterances.length - 1,
): HighlightMatch | null {
  if (startUtteranceIdx < 0 || startUtteranceIdx >= utterances.length) return null;

  const firstTextLength = utterances[startUtteranceIdx].text.length;
  let remaining = textLength - (firstTextLength - charOffsetStart);
  if (remaining <= 0) {
    return {
      startUtteranceIdx,
      endUtteranceIdx: startUtteranceIdx,
      charOffsetStart,
      charOffsetEnd: Math.min(charOffsetStart + textLength, firstTextLength),
    };
  }

  for (let i = startUtteranceIdx + 1; i <= maxEndIdx && i < utterances.length; i++) {
    remaining -= 1;
    if (remaining <= 0) {
      return { startUtteranceIdx, endUtteranceIdx: i - 1, charOffsetStart, charOffsetEnd: utterances[i - 1].text.length };
    }

    const len = utterances[i].text.length;
    if (remaining <= len) {
      return { startUtteranceIdx, endUtteranceIdx: i, charOffsetStart, charOffsetEnd: remaining };
    }
    remaining -= len;
  }

  return null;
}

function fuzzyMatch(citationText: string, utterances: TranscriptUtterance[], normFull: string): HighlightMatch | null {
  const normCit = normalizeText(citationText);
  const idx = normFull.indexOf(normCit);
  if (idx === -1) return null;

  let charCount = 0;
  for (let i = 0; i < utterances.length; i++) {
    const len = utterances[i].text.length;
    if (idx < charCount + len) {
      const charStart = idx - charCount;
      return resolveSpanningMatch(i, charStart, normCit.length, utterances);
    }
    charCount += len + 1;
  }
  return null;
}

export function useTranscriptHighlights(
  citations: CitationDTO[],
  captures: CaptureDTO[],
  transcript: TranscriptData | null
) {
  const capturesByCitationId = useMemo(() => {
    const m = new Map<number, CaptureDTO[]>();
    for (const c of captures) {
      if (c.citation_id == null) continue;
      const arr = m.get(c.citation_id) ?? [];
      arr.push(c);
      m.set(c.citation_id, arr);
    }
    return m;
  }, [captures]);

  const citationsByUtteranceIdx = useMemo(() => {
    if (!transcript?.utterances) return new Map<number, CitationWithCapture[]>();
    const utterances = transcript.utterances;
    const normFull = normalizeText(utterances.map((u) => u.text).join(" "));
    const m = new Map<number, CitationWithCapture[]>();
    for (const cit of citations) {
      const match = matchCitation(cit, utterances, normFull);
      if (!match) continue;

      for (let idx = match.startUtteranceIdx; idx <= match.endUtteranceIdx; idx++) {
        const charOffsetStart = idx === match.startUtteranceIdx ? match.charOffsetStart : 0;
        const charOffsetEnd =
          idx === match.endUtteranceIdx ? match.charOffsetEnd : utterances[idx].text.length;

        if (charOffsetEnd <= charOffsetStart) continue;

        const arr = m.get(idx) ?? [];
        arr.push({
          citation: cit,
          captures: capturesByCitationId.get(cit.id) ?? [],
          startsHighlight: idx === match.startUtteranceIdx,
          charOffsetStart,
          charOffsetEnd,
        });
        m.set(idx, arr);
      }
    }
    return m;
  }, [citations, captures, transcript, capturesByCitationId]);

  return { capturesByCitationId, citationsByUtteranceIdx };
}
