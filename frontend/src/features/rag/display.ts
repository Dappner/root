// Maps RAG domain concepts onto the presentational vocabulary of
// `@/components/ai`. Kept separate from the components so the primitives stay
// domain-agnostic and the mapping is easy to audit in one place.

import type { CitationTone } from "@/components/ai/citation-marker";
import { getSourceRouteHref } from "@/features/sources/routes";
import {
  BookOpen,
  Highlighter,
  Lightbulb,
  ListTree,
  Search,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import type { RagCitation, RagCitationKind } from "./types";

const CITATION_TONES: Record<RagCitationKind, CitationTone> = {
  citation: "quote",
  capture: "note",
  takeaway: "insight",
  source_section_summary: "section",
  transcript_chunk: "transcript",
};

export function citationTone(kind: RagCitationKind | undefined): CitationTone {
  return kind ? CITATION_TONES[kind] : "quote";
}

const CITATION_LABELS: Record<RagCitationKind, string> = {
  citation: "Quote",
  capture: "Note",
  takeaway: "Insight",
  source_section_summary: "Section summary",
  transcript_chunk: "Transcript",
};

export function citationLabel(kind: RagCitationKind): string {
  return CITATION_LABELS[kind];
}

/**
 * Icon for an in-flight tool call, chosen by tool name.
 *
 * Matching is substring-based because agent action names vary across
 * pipelines (`search_citations`, `hybrid_search`, …); the fallback keeps
 * unknown tools rendering sensibly rather than blank.
 */
export function toolIcon(name: string): LucideIcon {
  const normalized = name.toLowerCase();
  if (normalized.includes("takeaway")) return Lightbulb;
  if (normalized.includes("citation") || normalized.includes("highlight")) return Highlighter;
  if (normalized.includes("section") || normalized.includes("outline")) return ListTree;
  if (normalized.includes("source") || normalized.includes("library")) return BookOpen;
  if (normalized.includes("search") || normalized.includes("retriev")) return Search;
  return Sparkles;
}

/**
 * Deep link from a citation to where it lives in the library.
 *
 * The highlights page reads `?quote=` / `?capture=` and scrolls the matching
 * element into view with a flash, so quotes and captures land on the exact
 * entry. Takeaways and section summaries have no such anchor yet and fall back
 * to their tab. Returns null when the citation carries no source.
 */
export function citationHref(citation: RagCitation): string | null {
  const sourceId = citation.source_id;
  if (!sourceId) return null;

  switch (citation.type) {
    case "citation":
      return `${getSourceRouteHref(sourceId, "highlights")}?quote=${citation.entity_id}`;
    case "capture":
      return `${getSourceRouteHref(sourceId, "highlights")}?capture=${citation.entity_id}`;
    case "transcript_chunk":
      return getSourceRouteHref(sourceId, "transcript");
    case "takeaway":
      return getSourceRouteHref(sourceId, "takeaways");
    case "source_section_summary":
      return getSourceRouteHref(sourceId, "overview");
  }
}

export function prettifyToolName(name: string): string {
  const normalized = name
    .replace(/Schema$/, "")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replaceAll("_", " ")
    .trim();
  return normalized || "Tool";
}
