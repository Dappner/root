import { StyleSheet, Text, View } from "react-native";
import type {
  CaptureDTO,
  CitationResponse as CitationDTO,
} from "@/lib/api/rag-generated";
import { formatRelativeDate, formatTimestamp } from "@/lib/utils";
import { colors } from "./theme";

export function HubHighlightCard({
  citation,
  captures,
}: {
  citation: CitationDTO;
  captures: CaptureDTO[];
}) {
  const loc = citation.location;
  const avLoc =
    loc?.type === "av_v1" ? loc.av : loc?.type === "transcript_v1" ? loc.transcript : null;
  const tStart = avLoc?.tStartSec;
  const tEnd = avLoc?.tEndSec;
  const timeLabel =
    tStart != null
      ? tEnd != null && tEnd !== tStart
        ? `${formatTimestamp(tStart)}–${formatTimestamp(tEnd)}`
        : formatTimestamp(tStart)
      : null;

  return (
    <View style={styles.highlightCard}>
      <View style={styles.highlightKindRow}>
        <View style={styles.highlightKindBadge}>
          <Text style={styles.highlightKindText}>Highlight</Text>
        </View>
        {timeLabel && <Text style={styles.highlightTimestamp}>⏱ {timeLabel}</Text>}
      </View>
      <Text style={styles.highlightText}>"{citation.text}"</Text>
      {citation.summary && <Text style={styles.highlightSummary}>{citation.summary}</Text>}
      {captures.length > 0 && (
        <View style={styles.captureAttached}>
          <Text style={styles.captureAttachedLabel}>{captures.length > 1 ? "Notes" : "Note"}</Text>
          {captures.map((cap) => (
            <Text key={cap.id} style={styles.captureAttachedText}>{cap.text}</Text>
          ))}
        </View>
      )}
      <Text style={styles.highlightMeta}>{formatRelativeDate(citation.created_at)}</Text>
    </View>
  );
}

export function HubCaptureCard({ capture }: { capture: CaptureDTO }) {
  return (
    <View style={styles.highlightCard}>
      <View style={styles.highlightKindRow}>
        <View style={[styles.highlightKindBadge, styles.highlightKindBadgeCapture]}>
          <Text style={[styles.highlightKindText, styles.highlightKindTextCapture]}>Note</Text>
        </View>
      </View>
      <Text style={styles.highlightText}>{capture.text}</Text>
      {capture.summary && <Text style={styles.highlightSummary}>{capture.summary}</Text>}
      <Text style={styles.highlightMeta}>{formatRelativeDate(capture.created_at)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  highlightCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 6,
    marginBottom: 8,
  },
  highlightKindRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  highlightKindBadge: { backgroundColor: "#FEF3C7", borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  highlightKindBadgeCapture: { backgroundColor: colors.primaryLight },
  highlightKindText: { fontSize: 10, fontWeight: "700", color: "#92400E" },
  highlightKindTextCapture: { color: colors.primary },
  highlightText: { fontSize: 14, color: colors.foreground, lineHeight: 20, fontStyle: "italic" },
  highlightSummary: { fontSize: 13, color: colors.muted, lineHeight: 18 },
  highlightMeta: { fontSize: 11, color: colors.muted },
  highlightTimestamp: { fontSize: 11, color: colors.primary, fontWeight: "500" },
  captureAttached: { borderLeftWidth: 2, borderLeftColor: colors.primary, paddingLeft: 10, gap: 2 },
  captureAttachedLabel: { fontSize: 10, fontWeight: "700", color: colors.primary },
  captureAttachedText: { fontSize: 13, color: colors.foreground, lineHeight: 18 },
});
