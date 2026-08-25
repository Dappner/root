import type { AskResponse, CitationReference, RagCitation } from "./types";

const TYPE_LABELS: Record<RagCitation["type"], string> = {
  citation: "Citation",
  capture: "Capture",
  takeaway: "Takeaway",
  source_section_summary: "Section",
  transcript_chunk: "Transcript",
};

export function getCitationTypeLabel(type: RagCitation["type"]) {
  return TYPE_LABELS[type] ?? "Citation";
}

export function parseAnswerCitations(response: AskResponse): CitationReference[] {
  const citationIds = new Set<number>();
  const pattern = /<([\d,\s]+)>/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(response.answer)) !== null) {
    for (const raw of match[1].split(",").map((value) => value.trim())) {
      const id = Number(raw);
      if (Number.isInteger(id)) {
        citationIds.add(id);
      }
    }
  }

  return Array.from(citationIds)
    .sort((a, b) => a - b)
    .flatMap((id) => {
      const token = String(id);
      const citation = response.citations?.[token];
      return citation ? [{ token, citation }] : [];
    });
}
