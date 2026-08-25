import type { CitationDTO } from "@/features/sources/types";
import type { CitationLocation, PdfPosition } from "@/features/sources/utils/location";
import type { IHighlight, ScaledPosition } from "@nicklasastorian/react-pdf-annotator";

export function toPdfPosition(position: ScaledPosition): PdfPosition {
  const pageNumber = position.pageNumber ?? position.boundingRect.pageNumber ?? 1;
  const normalizeRect = (rect: ScaledPosition["boundingRect"]) => ({
    ...rect,
    pageNumber: rect.pageNumber ?? pageNumber,
  });

  return {
    ...position,
    pageNumber,
    boundingRect: normalizeRect(position.boundingRect),
    rects: position.rects.map(normalizeRect),
  };
}

export function citationToHighlight(
  citation: CitationDTO,
  captureText?: string | null
): IHighlight | null {
  const location = citation.location as CitationLocation | null | undefined;
  if (!location || location.type !== "pdf_v1" || !location.pdf?.position) return null;

  const position = location.pdf.position as unknown as ScaledPosition;

  return {
    id: `citation-${citation.id}`,
    content: { text: citation.text ?? "" },
    position,
    comment: captureText ?? "",
    meta: { citation },
  };
}

export function mergeHighlights(primary: IHighlight[], secondary: IHighlight[]) {
  const byId = new Map<string, IHighlight>();
  for (const highlight of primary) {
    if (highlight.id) byId.set(highlight.id, highlight);
  }
  for (const highlight of secondary) {
    if (highlight.id && !byId.has(highlight.id)) {
      byId.set(highlight.id, highlight);
    }
  }
  return Array.from(byId.values());
}
