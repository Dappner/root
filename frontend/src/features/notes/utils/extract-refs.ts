import type { JSONContent } from "@tiptap/core";

// Extracts up to `maxSentences` sentences of plain text from a Tiptap doc for preview.
export function extractPreviewText(body: object, maxSentences = 3): string {
  const doc = body as JSONContent;
  const parts: string[] = [];

  function walk(node: JSONContent) {
    if (node.type === "text" && node.text) parts.push(node.text);
    node.content?.forEach(walk);
  }
  walk(doc);

  const text = parts.join(" ").trim();
  if (!text) return "";

  // Split on sentence boundaries, take first maxSentences
  const sentences = text.match(/[^.!?]+[.!?]*/g) ?? [text];
  return sentences.slice(0, maxSentences).join(" ").trim();
}

export function extractCitationIds(doc: JSONContent): number[] {
  const seen = new Set<number>();
  function walk(node: JSONContent) {
    if (node.type === "citation" && node.attrs?.citationId) {
      seen.add(node.attrs.citationId as number);
    }
    node.content?.forEach(walk);
  }
  walk(doc);
  return Array.from(seen);
}

export interface EmbeddedSourceRef {
  sourceId: number;
  sourceTitle: string;
  sourceType: string;
}

export function extractSourceRefs(doc: JSONContent): EmbeddedSourceRef[] {
  const seen = new Map<number, EmbeddedSourceRef>();
  function walk(node: JSONContent) {
    if (node.type === "citation" && node.attrs?.sourceId) {
      const id = node.attrs.sourceId as number;
      if (!seen.has(id)) {
        seen.set(id, {
          sourceId: id,
          sourceTitle: (node.attrs.sourceTitle as string) ?? "",
          sourceType: (node.attrs.sourceType as string) ?? "",
        });
      }
    }
    node.content?.forEach(walk);
  }
  walk(doc);
  return Array.from(seen.values());
}
