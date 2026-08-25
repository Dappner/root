import { StyleSheet, Text } from "react-native";
import type { CitationReference, RagCitation } from "../types";

type CitationStyle = { bg: string; fg: string };

const TYPE_STYLES: Record<RagCitation["type"], CitationStyle> = {
  citation: { bg: "rgba(124,58,237,0.10)", fg: "#7C3AED" },
  capture: { bg: "rgba(37,99,235,0.10)", fg: "#2563EB" },
  takeaway: { bg: "rgba(217,119,6,0.10)", fg: "#D97706" },
  source_section_summary: { bg: "rgba(8,145,178,0.10)", fg: "#0891B2" },
  transcript_chunk: { bg: "rgba(225,29,72,0.10)", fg: "#E11D48" },
};

function styleFor(type: RagCitation["type"] | undefined): CitationStyle {
  return TYPE_STYLES[type ?? "citation"] ?? TYPE_STYLES.citation;
}

export function InlineCitationChip({
  token,
  citations,
  onPress,
}: {
  token: string;
  citations: CitationReference[];
  onPress?: (token: string) => void;
}) {
  const ref = citations.find((c) => c.token === token);
  const { bg, fg } = styleFor(ref?.citation.type);

  return (
    <Text
      suppressHighlighting
      onPress={onPress ? () => onPress(token) : undefined}
      style={[styles.chip, { backgroundColor: bg, color: fg }]}
    >
      {token}
    </Text>
  );
}

const styles = StyleSheet.create({
  chip: {
    fontSize: 11,
    fontWeight: "700",
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
    overflow: "hidden",
    marginHorizontal: 1,
  },
});
