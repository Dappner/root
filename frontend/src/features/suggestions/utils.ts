import type {
  ApproveSuggestionRequest,
  SuggestedCapturePayload,
  SuggestedCitationPayloadOutput,
  SuggestedPayloadEntitiesOutput,
  SuggestionPayload,
  SuggestionResponse,
  SuggestionWithSource,
  TranscriptV1Location,
} from "./types";

export function getSuggestionPayload(suggestion: SuggestionResponse): SuggestionPayload | null {
  const payload = suggestion.suggested_payload;
  if (!payload || typeof payload !== "object" || !("action" in payload)) {
    return null;
  }
  return payload as SuggestionPayload;
}

function getEntities(suggestion: SuggestionResponse): SuggestedPayloadEntitiesOutput | null {
  const payload = getSuggestionPayload(suggestion);
  if (!payload || payload.action !== "create_entities") return null;
  return payload;
}

// ─── Render shape ─────────────────────────────────────────────────────────
//
// A suggestion can be rendered in one of a small number of distinct shapes.
// Components dispatch on `kind` to choose the right view rather than
// recomputing flags (`isSimple`, `isMulti`, etc.) inline.
//
// "Simple" shapes (single-citation, single-capture, citation-with-capture)
// support inline text editing via the combined-text editor. "Multi" is
// read-only — the textarea cannot losslessly represent N citations × M
// captures, so the user approves as-is after the matcher's output.

export type RenderShape =
  | { kind: "no-payload" }
  | { kind: "uncertain" }
  | {
      kind: "single-citation";
      citation: SuggestedCitationPayloadOutput;
      entities: SuggestedPayloadEntitiesOutput;
    }
  | {
      kind: "single-capture";
      capture: SuggestedCapturePayload;
      entities: SuggestedPayloadEntitiesOutput;
    }
  | {
      kind: "citation-with-capture";
      citation: SuggestedCitationPayloadOutput;
      capture: SuggestedCapturePayload;
      entities: SuggestedPayloadEntitiesOutput;
    }
  | {
      kind: "multi";
      citations: SuggestedCitationPayloadOutput[];
      captures: SuggestedCapturePayload[];
      entities: SuggestedPayloadEntitiesOutput;
    };

export function getRenderShape(suggestion: SuggestionResponse): RenderShape {
  const payload = getSuggestionPayload(suggestion);
  if (!payload) return { kind: "no-payload" };
  if (payload.action === "uncertain") return { kind: "uncertain" };

  const entities = payload;
  const { citations, captures } = entities;

  if (citations.length === 1 && captures.length === 0) {
    return { kind: "single-citation", citation: citations[0], entities };
  }
  if (citations.length === 0 && captures.length === 1) {
    return { kind: "single-capture", capture: captures[0], entities };
  }
  if (citations.length === 1 && captures.length === 1) {
    return {
      kind: "citation-with-capture",
      citation: citations[0],
      capture: captures[0],
      entities,
    };
  }
  return { kind: "multi", citations, captures, entities };
}

/** A shape supports inline editing only when it has ≤1 citation and ≤1 capture. */
export function isEditableShape(shape: RenderShape): boolean {
  return (
    shape.kind === "single-citation" ||
    shape.kind === "single-capture" ||
    shape.kind === "citation-with-capture"
  );
}

// ─── Label builders ───────────────────────────────────────────────────────

type LabelFormat = "verb" | "noun";

/**
 * Build a human label for a suggestion's action.
 *
 * - `verb` form ("Save citation", "Create comment") — used as page titles.
 * - `noun` form ("Citation", "1 citation + 2 comments") — used as badges.
 */
export function getSuggestionLabel(
  suggestion: SuggestionResponse,
  format: LabelFormat,
): string {
  const shape = getRenderShape(suggestion);
  switch (shape.kind) {
    case "no-payload":
      return format === "verb" ? "Needs review" : "Needs review";
    case "uncertain":
      return format === "verb" ? "Review suggestion" : "Uncertain";
    case "single-citation":
      return format === "verb" ? "Save citation" : "Citation";
    case "single-capture":
      return format === "verb" ? "Create comment" : "Comment";
    case "citation-with-capture":
      return format === "verb" ? "Save citation and comment" : "Citation + Comment";
    case "multi": {
      const cit = shape.citations.length;
      const cap = shape.captures.length;
      if (cit > 0 && cap > 0) {
        return format === "verb"
          ? `Save ${cit} citations and ${cap} comments`
          : `${cit} citations + ${cap} comments`;
      }
      if (cit > 0) {
        return format === "verb"
          ? `Save ${cit} citations`
          : `${cit} citations`;
      }
      return format === "verb" ? `Create ${cap} comments` : `${cap} comments`;
    }
  }
}

// ─── Misc derived values ──────────────────────────────────────────────────

export function getSuggestionBody(suggestion: SuggestionResponse): string {
  const shape = getRenderShape(suggestion);
  switch (shape.kind) {
    case "no-payload":
    case "uncertain":
      return suggestion.voice_transcript ?? "";
    case "single-citation":
      return shape.citation.text;
    case "single-capture":
      return shape.capture.text;
    case "citation-with-capture":
      return `${shape.citation.text}\n\n${shape.capture.text}`;
    case "multi": {
      const lines: string[] = [];
      shape.citations.forEach((c, i) => lines.push(`Citation ${i + 1}: ${c.text}`));
      shape.captures.forEach((c, i) => {
        const tie = c.citation_idx != null ? ` (→ citation ${c.citation_idx + 1})` : "";
        lines.push(`Comment ${i + 1}${tie}: ${c.text}`);
      });
      return lines.join("\n\n");
    }
  }
}

/**
 * Extract a citation's transcript location (utterance index range + timestamps)
 * when the source is transcript-derived (podcast/video). Returns null for
 * sources without a transcript location (e.g. book scans, web articles).
 */
export function getCitationTranscriptLocation(
  citation: SuggestedCitationPayloadOutput,
): TranscriptV1Location | null {
  const location = citation.location;
  if (location?.mode !== "derived" || location.type !== "transcript_v1") {
    return null;
  }
  return location.transcript ?? null;
}

/**
 * Extract the playback start timestamp (in seconds) for a citation, when the
 * source is transcript-derived. Returns null otherwise.
 */
export function getCitationStartSec(
  citation: SuggestedCitationPayloadOutput,
): number | null {
  return getCitationTranscriptLocation(citation)?.tStartSec ?? null;
}

export function getSuggestionConfidence(suggestion: SuggestionResponse): number | null {
  const payload = getSuggestionPayload(suggestion);
  if (!payload || typeof payload.confidence !== "number") return null;
  return Math.round(payload.confidence * 100);
}

export function getSuggestionReasoning(suggestion: SuggestionResponse): string | null {
  const payload = getSuggestionPayload(suggestion);
  return payload?.reasoning_summary ?? suggestion.error ?? null;
}

// ─── Entity counts ────────────────────────────────────────────────────────

export interface SuggestionCounts {
  citations: number;
  comments: number;
}

/**
 * Count the citations and comments a suggestion would create, derived from its
 * payload. Returns zeros for non-`create_entities` shapes (no-payload/uncertain).
 * Takeaways are intentionally omitted — they aren't part of the suggestion payload.
 */
export function getSuggestionCounts(suggestion: SuggestionResponse): SuggestionCounts {
  const entities = getEntities(suggestion);
  return {
    citations: entities?.citations.length ?? 0,
    comments: entities?.captures.length ?? 0,
  };
}

/** Build a "2 citations · 3 comments" meta string, omitting zero/empty parts. */
export function getSuggestionMetaLine(suggestion: SuggestionResponse): string {
  const { citations, comments } = getSuggestionCounts(suggestion);
  const parts: string[] = [];
  if (citations > 0) parts.push(`${citations} ${citations === 1 ? "citation" : "citations"}`);
  if (comments > 0) parts.push(`${comments} ${comments === 1 ? "comment" : "comments"}`);
  return parts.join(" · ");
}

// ─── Source grouping ──────────────────────────────────────────────────────

export interface SourceSuggestionGroup {
  sourceId: number;
  source?: SuggestionWithSource["source"];
  suggestions: SuggestionWithSource[];
  /** Roll-up across every suggestion in the group. */
  counts: {
    notes: number;
    citations: number;
    comments: number;
  };
  /** Average confidence (0–100) across suggestions that have one, or null. */
  avgConfidence: number | null;
  /** Most-recent created_at across the group (epoch ms) — drives group ordering. */
  latestAt: number;
}

/**
 * Group suggestions by their source. Suggestions keep the order they arrive in
 * within each group (the caller sorts beforehand); groups are ordered by their
 * most-recent suggestion so the freshest source surfaces first. The roll-up
 * counts/avg-confidence feed the single-row group header on the list.
 */
export function groupSuggestionsBySource(
  suggestions: SuggestionWithSource[],
): SourceSuggestionGroup[] {
  const groups = new Map<number, SourceSuggestionGroup>();

  for (const suggestion of suggestions) {
    let group = groups.get(suggestion.source_id);
    if (!group) {
      group = {
        sourceId: suggestion.source_id,
        source: suggestion.source,
        suggestions: [],
        counts: { notes: 0, citations: 0, comments: 0 },
        avgConfidence: null,
        latestAt: 0,
      };
      groups.set(suggestion.source_id, group);
    }
    group.suggestions.push(suggestion);
    const { citations, comments } = getSuggestionCounts(suggestion);
    group.counts.notes += 1;
    group.counts.citations += citations;
    group.counts.comments += comments;
    group.latestAt = Math.max(group.latestAt, Date.parse(suggestion.created_at) || 0);
  }

  for (const group of groups.values()) {
    const confidences = group.suggestions
      .map((s) => getSuggestionConfidence(s))
      .filter((c): c is number => c != null);
    group.avgConfidence = confidences.length
      ? Math.round(confidences.reduce((a, b) => a + b, 0) / confidences.length)
      : null;
  }

  return [...groups.values()].sort((a, b) => b.latestAt - a.latestAt);
}

/** Build a "5 notes · 12 citations · 3 comments" roll-up for a source group. */
export function getGroupMetaLine(group: SourceSuggestionGroup): string {
  const { notes, citations, comments } = group.counts;
  const parts: string[] = [`${notes} ${notes === 1 ? "note" : "notes"}`];
  if (citations > 0) parts.push(`${citations} ${citations === 1 ? "citation" : "citations"}`);
  if (comments > 0) parts.push(`${comments} ${comments === 1 ? "comment" : "comments"}`);
  return parts.join(" · ");
}

// ─── Approval payload builders ────────────────────────────────────────────

/**
 * Build an approval payload from the simple-edit textarea contents. For the
 * `citation-with-capture` shape the text is split by the first blank line —
 * the citation gets the prefix, the comment gets the rest. Returns the
 * original payload unchanged for shapes that can't be edited inline.
 */
export function updateSuggestionPayloadText(
  suggestion: SuggestionResponse,
  text: string,
): ApproveSuggestionRequest["payload"] {
  const shape = getRenderShape(suggestion);
  if (shape.kind === "no-payload") return null;
  if (shape.kind === "uncertain") return getSuggestionPayload(suggestion);
  if (shape.kind === "multi") return shape.entities;

  if (shape.kind === "single-citation") {
    return {
      ...shape.entities,
      citations: [{ ...shape.citation, text }],
      captures: [],
    };
  }
  if (shape.kind === "single-capture") {
    return {
      ...shape.entities,
      citations: [],
      captures: [{ ...shape.capture, text }],
    };
  }
  // citation-with-capture: split by first blank line.
  const [citationText, ...captureParts] = text.split(/\n\s*\n/);
  return {
    ...shape.entities,
    citations: [{ ...shape.citation, text: citationText.trim() }],
    captures: [
      {
        ...shape.capture,
        text: captureParts.join("\n\n").trim() || shape.capture.text,
      },
    ],
  };
}

/**
 * Build an approval payload that includes only the selected citations and
 * captures. Citation indices are remapped (dropping a citation shifts later
 * indices); captures whose tied citation was excluded fall through to
 * standalone (citation_idx cleared) so the thought is still saved.
 *
 * Optional text overrides let the caller pass edited text per index.
 */
export function buildSelectedApprovePayload(
  suggestion: SuggestionResponse,
  selectedCitationIndices: Set<number>,
  selectedCaptureIndices: Set<number>,
  options: {
    citationTexts?: string[];
    captureTexts?: string[];
  } = {},
): ApproveSuggestionRequest["payload"] {
  const payload = getSuggestionPayload(suggestion);
  if (!payload) return null;
  if (payload.action !== "create_entities") return payload;

  // Build old-index → new-index map for kept citations.
  const keptCitationOldToNew = new Map<number, number>();
  const citations = payload.citations
    .map((c, oldIdx) => {
      if (!selectedCitationIndices.has(oldIdx)) return null;
      keptCitationOldToNew.set(oldIdx, keptCitationOldToNew.size);
      return { ...c, text: options.citationTexts?.[oldIdx] ?? c.text };
    })
    .filter((c): c is NonNullable<typeof c> => c !== null);

  const captures = payload.captures
    .map((c, oldIdx) => {
      if (!selectedCaptureIndices.has(oldIdx)) return null;
      const remappedIdx =
        c.citation_idx != null ? keptCitationOldToNew.get(c.citation_idx) : undefined;
      return {
        ...c,
        // If the tied citation was excluded, drop the tie; capture becomes standalone.
        citation_idx: remappedIdx,
        text: options.captureTexts?.[oldIdx] ?? c.text,
      };
    })
    .filter((c): c is NonNullable<typeof c> => c !== null);

  return { ...payload, citations, captures };
}

// ─── Reviewed approval payload ─────────────────────────────────────────────────

/**
 * Per-item draft state captured while reviewing a note in the full-screen
 * reviewer. One entry exists for each citation and each capture in the original
 * payload, keyed by its kind + original index. Items keep the type the backend
 * assigned — the reviewer edits text or drops an item, it does not reclassify
 * across the citation/capture boundary.
 */
export interface ReviewedItemDraft {
  kind: "citation" | "capture";
  /** Index into the original payload's citations[] or captures[] array. */
  index: number;
  editedText: string;
  dismissed: boolean;
}

/**
 * Build an approval payload from the per-item review drafts: apply edited text,
 * drop dismissed items, and keep each item the type it already is. Surviving
 * captures' `citation_idx` is remapped to the new citation indices; a capture
 * tied to a dismissed citation falls through to standalone (citation_idx cleared).
 */
export function buildReviewedApprovePayload(
  suggestion: SuggestionResponse,
  items: ReviewedItemDraft[],
): ApproveSuggestionRequest["payload"] {
  const payload = getSuggestionPayload(suggestion);
  if (!payload) return null;
  if (payload.action !== "create_entities") return payload;

  const citationDrafts = new Map<number, ReviewedItemDraft>();
  const captureDrafts = new Map<number, ReviewedItemDraft>();
  for (const item of items) {
    if (item.kind === "citation") citationDrafts.set(item.index, item);
    else captureDrafts.set(item.index, item);
  }

  // Build old-index → new-index for surviving citations first, so captures can
  // remap their ties against it.
  const keptCitationOldToNew = new Map<number, number>();
  const citations = payload.citations
    .map((c, oldIdx) => {
      const draft = citationDrafts.get(oldIdx);
      if (draft?.dismissed) return null;
      keptCitationOldToNew.set(oldIdx, keptCitationOldToNew.size);
      return { ...c, text: draft?.editedText ?? c.text };
    })
    .filter((c): c is NonNullable<typeof c> => c !== null);

  const captures: SuggestedCapturePayload[] = [];
  payload.captures.forEach((c, oldIdx) => {
    const draft = captureDrafts.get(oldIdx);
    if (draft?.dismissed) return;
    const remappedIdx =
      c.citation_idx != null ? keptCitationOldToNew.get(c.citation_idx) : undefined;
    captures.push({
      ...c,
      // Tie dropped when its citation was dismissed → capture becomes standalone.
      citation_idx: remappedIdx,
      text: draft?.editedText ?? c.text,
    });
  });

  return { ...payload, citations, captures };
}
