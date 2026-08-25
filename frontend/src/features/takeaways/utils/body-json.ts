import type { JSONContent } from "@tiptap/core";

export function plainTextToTipTapDoc(text: string): JSONContent {
  const trimmed = text ?? "";
  const paragraphs = trimmed.length === 0
    ? [{ type: "paragraph" }]
    : trimmed.split(/\n{2,}/).map((block) => {
        const content = block
          .split("\n")
          .flatMap((line, index, arr) => {
            const nodes: JSONContent[] = line.length > 0
              ? [{ type: "text", text: line }]
              : [];
            if (index < arr.length - 1) {
              nodes.push({ type: "hardBreak" });
            }
            return nodes;
          });
        return content.length > 0
          ? { type: "paragraph", content }
          : { type: "paragraph" };
      });

  return { type: "doc", content: paragraphs };
}

export function bodyJsonOrFallback(
  bodyJson: object | null | undefined,
  legacyBody: string | null | undefined,
): JSONContent {
  if (bodyJson) return bodyJson as JSONContent;
  return plainTextToTipTapDoc(legacyBody ?? "");
}
