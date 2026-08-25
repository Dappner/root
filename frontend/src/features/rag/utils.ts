import type { AskResponse, CitationReference } from "./types";

/**
 * Superscript numbers for footnote markers
 */
const SUPERSCRIPTS = ["¹", "²", "³", "⁴", "⁵", "⁶", "⁷", "⁸", "⁹"];

/**
 * Get superscript character for a number (1-9)
 */
export function getSuperscript(num: number): string {
  if (num < 1 || num > 9) return `[${num}]`;
  return SUPERSCRIPTS[num - 1];
}

export interface ParsedAnswer {
  text: string;
  citations: CitationReference[];
}

export function parseAnswer(response: AskResponse): ParsedAnswer {
  const { answer = "", citations: ragCitations } = response;

  if (!answer) {
    return { text: "", citations: [] };
  }

  // Parse Jetflow-style citation tags: <1>, <2>, or comma-separated <1, 2>.
  const citationTagPattern = /<([\d,\s]+)>/g;
  const citationIds = new Set<number>();

  let match: RegExpExecArray | null;
  while ((match = citationTagPattern.exec(answer)) !== null) {
    for (const rawId of match[1].split(",").map((t) => t.trim())) {
      const id = Number(rawId);
      if (Number.isInteger(id)) citationIds.add(id);
    }
  }

  const citations: CitationReference[] = Array.from(citationIds)
    .sort((a, b) => a - b)
    .flatMap((citationId) => {
      const token = citationId.toString();
      const ragCitation = ragCitations?.[token];
      if (!ragCitation) return [];
      return [{
        token,
        display: token,
        index: citationId,
        ref_key: `${ragCitation.type}:${ragCitation.entity_id}`,
        citation: ragCitation,
        sourceId: ragCitation.source_id,
      }];
    });

  return { text: answer, citations };
}
