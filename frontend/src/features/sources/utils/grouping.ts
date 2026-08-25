import type { CaptureDTO } from "@/features/captures/types";
import type { SourceTakeawayDTO } from "@/features/takeaways/types";
import type {
  CitationDTO,
  CitationWithCapture,
  GroupedHighlights,
  GroupedSection,
  SourceSectionDTO,
} from "../types";
import { sortCitationsByLocation } from "./sorting";

interface EnrichedHighlightsData {
  sections: SourceSectionDTO[];
  citations: CitationDTO[];
  captures: CaptureDTO[];
  takeaways: SourceTakeawayDTO[];
}

/**
 * Builds a lookup map of takeaways indexed by citation ID.
 * Allows efficient client-side enrichment of citations with their takeaways.
 *
 * @param takeaways - Array of source takeaways
 * @returns Map of citation ID to array of takeaways
 */
function buildTakeawayLookup(
  takeaways: SourceTakeawayDTO[],
): Map<number, SourceTakeawayDTO[]> {
  const takeawaysByCitationId = new Map<number, SourceTakeawayDTO[]>();

  for (const takeaway of takeaways) {
    const citations = takeaway.citations ?? [];
    for (const citationRef of citations) {
      const citationId = citationRef.id;
      const arr = takeawaysByCitationId.get(citationId) ?? [];
      // Deduplicate: only add if not already present
      if (!arr.some((t) => t.id === takeaway.id)) {
        arr.push(takeaway);
      }
      takeawaysByCitationId.set(citationId, arr);
    }
  }

  return takeawaysByCitationId;
}

/**
 * Builds lookup maps for captures indexed by citation ID and section ID.
 * Separates linked captures (with citation_id) from standalone captures (no citation_id).
 *
 * @param captures - Array of capture objects
 * @returns Object with capture lookup maps and standalone count
 */
function buildCaptureLookups(captures: CaptureDTO[]): {
  capturesByCitationId: Map<number, CaptureDTO[]>;
  capturesBySectionId: Map<number | null, CaptureDTO[]>;
  standaloneCaptureCount: number;
} {
  const capturesByCitationId = new Map<number, CaptureDTO[]>();
  const capturesBySectionId = new Map<number | null, CaptureDTO[]>();
  let standaloneCaptureCount = 0;

  for (const cap of captures) {
    if (cap.citation_id != null) {
      const arr = capturesByCitationId.get(cap.citation_id) ?? [];
      arr.push(cap);
      capturesByCitationId.set(cap.citation_id, arr);
    } else {
      const key = cap.section_id ?? null;
      const arr = capturesBySectionId.get(key) ?? [];
      arr.push(cap);
      capturesBySectionId.set(key, arr);
      standaloneCaptureCount += 1;
    }
  }

  // Sort captures attached to each citation chronologically (oldest first).
  for (const arr of capturesByCitationId.values()) {
    arr.sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );
  }

  return { capturesByCitationId, capturesBySectionId, standaloneCaptureCount };
}

/**
 * Enriches citations with captures and takeaways.
 * Creates CitationWithCapture objects that include linked capture and full takeaway data.
 *
 * @param citations - Array of citation objects
 * @param capturesByCitationId - Map of citation ID to capture
 * @param takeawaysByCitationId - Map of citation ID to takeaways
 * @returns Array of enriched citations with captures
 */
function enrichCitationsWithCaptures(
  citations: CitationDTO[],
  capturesByCitationId: Map<number, CaptureDTO[]>,
  takeawaysByCitationId: Map<number, SourceTakeawayDTO[]>,
): CitationWithCapture[] {
  return citations.map((cit) => {
    const citationTakeaways = takeawaysByCitationId.get(cit.id) ?? [];

    return {
      citation: {
        ...cit,
        takeaways: citationTakeaways.length > 0 ? citationTakeaways : undefined,
      },
      captures: capturesByCitationId.get(cit.id) ?? [],
    };
  });
}

/**
 * Groups citations by section ID and sorts them by location.
 *
 * @param citationsWithCaptures - Array of enriched citations
 * @returns Map of section ID to sorted array of citations
 */
function groupCitationsBySection(
  citationsWithCaptures: CitationWithCapture[],
): Map<number | null, CitationWithCapture[]> {
  const citationsBySectionId = new Map<number | null, CitationWithCapture[]>();

  for (const cwc of citationsWithCaptures) {
    const key = cwc.citation.section_id ?? null;
    const arr = citationsBySectionId.get(key) ?? [];
    arr.push(cwc);
    citationsBySectionId.set(key, arr);
  }

  // Sort citations within each section by location
  for (const citationsInSection of citationsBySectionId.values()) {
    citationsInSection.sort(sortCitationsByLocation);
  }

  return citationsBySectionId;
}

/**
 * Sorts captures within each section by created_at timestamp.
 *
 * @param capturesBySectionId - Map of section ID to captures array (mutated in place)
 */
function sortCapturesInSections(
  capturesBySectionId: Map<number | null, CaptureDTO[]>,
): void {
  for (const capturesInSection of capturesBySectionId.values()) {
    capturesInSection.sort((a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
  }
}

/**
 * Builds a flat array of GroupedSection objects from section array.
 * Creates GroupedSection objects with citations and captures (no hierarchy).
 *
 * @param sections - Array of section objects
 * @param citationsBySectionId - Map of section ID to citations
 * @param capturesBySectionId - Map of section ID to captures
 * @returns Array of sections sorted by order_index
 */
function buildSectionList(
  sections: SourceSectionDTO[],
  citationsBySectionId: Map<number | null, CitationWithCapture[]>,
  capturesBySectionId: Map<number | null, CaptureDTO[]>,
): GroupedSection[] {
  // Create all GroupedSection objects (no children since sections are flat)
  const groupedSections = sections.map((section) => ({
    section,
    citations: citationsBySectionId.get(section.id) ?? [],
    captures: capturesBySectionId.get(section.id) ?? [],
    children: [], // Always empty - sections are no longer hierarchical
  }));

  // Sort sections by order_index
  groupedSections.sort((a, b) => a.section.order_index - b.section.order_index);

  return groupedSections;
}

/**
 * Groups and organizes highlights data into a flat structure by section.
 *
 * This function performs several key operations:
 * 1. Enriches citations with full takeaway data (client-side join)
 * 2. Attaches captures to their parent citations
 * 3. Groups citations and standalone captures by section
 * 4. Sorts all items appropriately (by location, order_index, or created_at)
 *
 * The result is a flat list of sections with their highlights,
 * plus an "unsorted" bucket for items without section assignment.
 *
 * @param data - Raw response data with sections, citations, captures, and takeaways
 * @returns Organized flat structure ready for UI rendering
 */
export function groupHighlightsBySection(
  data: EnrichedHighlightsData,
): GroupedHighlights {
  const { sections, citations, captures, takeaways } = data;

  // Build lookup maps for efficient data joining
  const takeawaysByCitationId = buildTakeawayLookup(takeaways);
  const { capturesByCitationId, capturesBySectionId, standaloneCaptureCount } =
    buildCaptureLookups(captures);

  // Enrich citations with captures and takeaways
  const citationsWithCaptures = enrichCitationsWithCaptures(
    citations,
    capturesByCitationId,
    takeawaysByCitationId,
  );

  // Group and sort citations by section
  const citationsBySectionId = groupCitationsBySection(citationsWithCaptures);

  // Sort captures within each section
  sortCapturesInSections(capturesBySectionId);

  // Build flat section list (no hierarchy)
  const sectionList = buildSectionList(
    sections,
    citationsBySectionId,
    capturesBySectionId,
  );

  // Unsorted items (no section assignment)
  const unsorted = {
    citations: citationsBySectionId.get(null) ?? [],
    captures: capturesBySectionId.get(null) ?? [],
  };

  return {
    sections: sectionList,
    unsorted,
    totalCount: citations.length + standaloneCaptureCount,
  };
}
