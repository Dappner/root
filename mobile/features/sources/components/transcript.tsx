import type { CitationWithCapture } from "@/features/sources/hooks";
import { formatRelativeDate, formatTimestamp } from "@/lib/utils";
import type { TranscriptUtterance } from "@/lib/api/rag-generated";
import { ChatCircle } from "phosphor-react-native/src/icons/ChatCircle";
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from "react-native";

const colors = {
  card: "#FCFCF5",
  foreground: "#2C2C2C",
  muted: "#666050",
  border: "#C9C0A8",
  secondary: "#E4DBC5",
  primary: "#3F6B51",
};

// ─── Segment builder ───────────────────────────────────────────────────────────
// Mirrors the FE approach: split utterance text into plain / highlighted segments
// based on char offsets, handle multiple non-overlapping citations per utterance.

type Segment =
  | { kind: "plain"; text: string }
  | { kind: "highlight"; text: string; cwc: CitationWithCapture };

function buildSegments(text: string, citations: CitationWithCapture[]): Segment[] {
  if (citations.length === 0) return [{ kind: "plain", text }];

  // Sort by charOffsetStart, remove overlaps (keep first)
  const sorted = [...citations].sort((a, b) => a.charOffsetStart - b.charOffsetStart);
  const deduped: CitationWithCapture[] = [];
  let cursor = 0;
  for (const cwc of sorted) {
    if (cwc.charOffsetStart >= cursor) {
      deduped.push(cwc);
      cursor = cwc.charOffsetEnd;
    }
  }

  const segments: Segment[] = [];
  let pos = 0;
  for (const cwc of deduped) {
    const s = Math.max(0, cwc.charOffsetStart);
    const e = Math.min(text.length, cwc.charOffsetEnd);
    if (s > pos) segments.push({ kind: "plain", text: text.slice(pos, s) });
    if (s < e)   segments.push({ kind: "highlight", text: text.slice(s, e), cwc });
    pos = e;
  }
  if (pos < text.length) segments.push({ kind: "plain", text: text.slice(pos) });
  return segments;
}

// ─── UtteranceRow ──────────────────────────────────────────────────────────────

export function UtteranceRow({
  utterance,
  citations,
  onHighlightPress,
  isActive = false,
  showTimestamp = true,
  fontSize = 14,
}: {
  utterance: TranscriptUtterance;
  citations: CitationWithCapture[];
  onHighlightPress: (cwc: CitationWithCapture) => void;
  isActive?: boolean;
  showTimestamp?: boolean;
  fontSize?: number;
}) {
  const segments = buildSegments(utterance.text, citations);
  const lineHeight = Math.round(fontSize * 1.55);
  const baseTextStyle = [s.utteranceText, isActive && s.utteranceTextActive, { fontSize, lineHeight }];

  const iconCandidates = citations.filter((c) => c.captures.length > 0 && c.startsHighlight);
  const primaryCaptureCwc = iconCandidates.length > 0
    ? iconCandidates.reduce((a, b) => a.charOffsetStart <= b.charOffsetStart ? a : b)
    : null;

  return (
    <View style={[s.row, isActive && s.rowActive]}>
      {showTimestamp && (
        <View style={s.leftCol}>
          <Text style={s.timestamp}>{formatTimestamp(utterance.start)}</Text>
        </View>
      )}
      <View style={s.body}>
        <Text style={baseTextStyle}>
          {segments.map((seg, i) => {
            if (seg.kind === "plain") {
              return <Text key={i}>{seg.text}</Text>;
            }
            return (
              <Text
                key={i}
                style={s.highlightSpan}
                onPress={() => onHighlightPress(seg.cwc)}
              >{seg.text}</Text>
            );
          })}
        </Text>
      </View>
      {primaryCaptureCwc && (
        <TouchableOpacity
          style={s.captureIconButton}
          onPress={() => onHighlightPress(primaryCaptureCwc)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          activeOpacity={0.7}
        >
          <ChatCircle size={17} color={colors.primary} weight="fill" />
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── HighlightModal ────────────────────────────────────────────────────────────

function getTimestampLabel(cwc: CitationWithCapture): string | null {
  const loc = cwc.citation.location;
  if (!loc) return null;
  const avLoc =
    loc.type === "av_v1" ? loc.av : loc.type === "transcript_v1" ? loc.transcript : null;
  if (!avLoc) return null;
  const tStart = avLoc.tStartSec;
  const tEnd = avLoc.tEndSec;
  if (tStart == null) return null;
  if (tEnd != null && tEnd !== tStart) {
    return `${formatTimestamp(tStart)}–${formatTimestamp(tEnd)}`;
  }
  return formatTimestamp(tStart);
}

export function HighlightModal({
  highlight,
  onClose,
}: {
  highlight: CitationWithCapture | null;
  onClose: () => void;
}) {
  const timeLabel = highlight ? getTimestampLabel(highlight) : null;

  return (
    <Modal
      visible={highlight != null}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={s.backdrop} onPress={onClose}>
        <Pressable style={s.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={s.handle} />
          {highlight && (
            <>
              <View style={s.kindRow}>
                <View style={s.kindBadge}>
                  <Text style={s.kindText}>Highlight</Text>
                </View>
                {timeLabel && (
                  <Text style={s.timestampLabel}>⏱ {timeLabel}</Text>
                )}
              </View>
              <Text style={s.quote}>"{highlight.citation.text}"</Text>
              {highlight.citation.summary && (
                <Text style={s.summary}>{highlight.citation.summary}</Text>
              )}
              {highlight.captures.length > 0 && (
                <View style={s.captureBlock}>
                  <Text style={s.captureBlockLabel}>{highlight.captures.length > 1 ? "Notes" : "Note"}</Text>
                  {highlight.captures.map((cap) => (
                    <Text key={cap.id} style={s.captureBlockText}>{cap.text}</Text>
                  ))}
                </View>
              )}
              <Text style={s.meta}>{formatRelativeDate(highlight.citation.created_at)}</Text>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  row: {
    flexDirection: "row",
    paddingVertical: 9,
    paddingHorizontal: 8,
    gap: 10,
    alignItems: "flex-start",
  },
  rowActive: { backgroundColor: colors.secondary, borderRadius: 8 },
  leftCol: { width: 38, alignItems: "center", gap: 4, paddingTop: 2 },
  timestamp: { fontSize: 10, color: colors.muted, fontWeight: "500" },
  body: { flex: 1 },
  captureIconButton: {
    width: 26,
    minHeight: 26,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  utteranceText: { fontSize: 14, lineHeight: 21, color: colors.foreground },
  utteranceTextActive: { fontWeight: "500" },
  highlightSpan: { backgroundColor: "#FEF08A", color: "#92400E", fontWeight: "500" },

  // HighlightModal
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 40,
    gap: 12,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: "center",
    marginBottom: 8,
  },
  kindRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  kindBadge: { backgroundColor: "#FEF3C7", borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  kindText: { fontSize: 10, fontWeight: "700", color: "#92400E" },
  timestampLabel: { fontSize: 11, color: colors.primary, fontWeight: "500" },
  quote: { fontSize: 16, color: colors.foreground, lineHeight: 24, fontStyle: "italic" },
  summary: { fontSize: 13, color: colors.muted, lineHeight: 19 },
  captureBlock: { borderLeftWidth: 2, borderLeftColor: colors.primary, paddingLeft: 10, gap: 2 },
  captureBlockLabel: { fontSize: 10, fontWeight: "700", color: colors.primary },
  captureBlockText: { fontSize: 13, color: colors.foreground, lineHeight: 18 },
  meta: { fontSize: 11, color: colors.muted },
});
