import type { CitationDTO, CaptureDTO, SourceSectionDTO, SourceTakeawayDTO } from "../api";
import { StyleSheet, Text, View } from "react-native";

export const colors = {
  background: "#FAF5EB",
  card: "#FCFCF5",
  foreground: "#2C2C2C",
  muted: "#666050",
  border: "#C9C0A8",
  secondary: "#E4DBC5",
  primary: "#3F6B51",
};

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CitationWithCapture {
  citation: CitationDTO;
  captures: CaptureDTO[];
}

export interface GroupedSection {
  section: SourceSectionDTO | null;
  citationsWithCaptures: CitationWithCapture[];
  standaloneCaptures: CaptureDTO[];
}

// ─── Grouping ─────────────────────────────────────────────────────────────────

function getTimestamp(citation: CitationDTO): number | null {
  const loc = citation.location;
  if (!loc) return null;
  const ts =
    loc.type === "av_v1"
      ? loc.av?.tStartSec
      : loc.type === "transcript_v1"
        ? loc.transcript?.tStartSec
        : null;
  return typeof ts === "number" ? ts : null;
}

export function groupHighlights(
  sections: SourceSectionDTO[],
  citations: CitationDTO[],
  captures: CaptureDTO[],
): { sectionGroups: GroupedSection[]; unsorted: GroupedSection } {
  const capturesByCitationId = new Map<number, CaptureDTO[]>();
  const standaloneCapsBySection = new Map<number | null, CaptureDTO[]>();

  for (const cap of captures) {
    if (cap.citation_id != null) {
      const arr = capturesByCitationId.get(cap.citation_id) ?? [];
      arr.push(cap);
      capturesByCitationId.set(cap.citation_id, arr);
    } else {
      const key = cap.section_id ?? null;
      const arr = standaloneCapsBySection.get(key) ?? [];
      arr.push(cap);
      standaloneCapsBySection.set(key, arr);
    }
  }

  for (const caps of standaloneCapsBySection.values()) {
    caps.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }

  const cwcBySectionId = new Map<number | null, CitationWithCapture[]>();
  for (const cit of citations) {
    const key = cit.section_id ?? null;
    const arr = cwcBySectionId.get(key) ?? [];
    arr.push({ citation: cit, captures: capturesByCitationId.get(cit.id) ?? [] });
    cwcBySectionId.set(key, arr);
  }

  for (const arr of cwcBySectionId.values()) {
    arr.sort((a, b) => {
      const tsA = getTimestamp(a.citation);
      const tsB = getTimestamp(b.citation);
      if (tsA != null && tsB != null) return tsA - tsB;
      if (tsA != null) return -1;
      if (tsB != null) return 1;
      return new Date(a.citation.created_at).getTime() - new Date(b.citation.created_at).getTime();
    });
  }

  const sorted = [...sections].sort((a, b) => a.order_index - b.order_index);
  const sectionGroups: GroupedSection[] = sorted.map((section) => ({
    section,
    citationsWithCaptures: cwcBySectionId.get(section.id) ?? [],
    standaloneCaptures: standaloneCapsBySection.get(section.id) ?? [],
  }));

  return {
    sectionGroups,
    unsorted: {
      section: null,
      citationsWithCaptures: cwcBySectionId.get(null) ?? [],
      standaloneCaptures: standaloneCapsBySection.get(null) ?? [],
    },
  };
}

// ─── Shared UI components ─────────────────────────────────────────────────────

export function SectionGroup({ group }: { group: GroupedSection }) {
  return (
    <View style={s.sectionBlock}>
      {group.section && (
        <>
          <Text style={s.sectionTitle}>{group.section.title}</Text>
          {group.section.summary && <Text style={s.sectionSummary}>{group.section.summary}</Text>}
        </>
      )}
      {group.citationsWithCaptures.length > 0 && (
        <View style={s.itemList}>
          {group.citationsWithCaptures.map(({ citation, captures }) => (
            <CitationItem key={citation.id} citation={citation} captures={captures} />
          ))}
        </View>
      )}
      {group.standaloneCaptures.length > 0 && (
        <View style={[s.itemList, group.citationsWithCaptures.length > 0 && { marginTop: 8 }]}>
          {group.standaloneCaptures.map((cap) => (
            <CaptureItem key={cap.id} capture={cap} />
          ))}
        </View>
      )}
    </View>
  );
}

export function CitationItem({ citation, captures }: { citation: CitationDTO; captures: CaptureDTO[] }) {
  return (
    <View style={s.citationCard}>
      {citation.info_type && (
        <View style={s.infoBadge}>
          <Text style={s.infoBadgeText}>{citation.info_type}</Text>
        </View>
      )}
      <Text style={s.citationText}>{citation.text}</Text>
      {citation.context && <Text style={s.contextText}>{citation.context}</Text>}
      {citation.speaker && <Text style={s.speakerText}>— {citation.speaker}</Text>}
      {captures.length > 0 && (
        <View style={s.attachedCapture}>
          <Text style={s.attachedCaptureLabel}>{captures.length > 1 ? "Notes" : "Note"}</Text>
          {captures.map((cap) => (
            <Text key={cap.id} style={s.attachedCaptureText}>{cap.text}</Text>
          ))}
        </View>
      )}
    </View>
  );
}

export function CaptureItem({ capture }: { capture: CaptureDTO }) {
  return (
    <View style={[s.captureCard]}>
      <Text style={s.citationText}>{capture.text}</Text>
      {capture.summary && <Text style={s.contextText}>{capture.summary}</Text>}
    </View>
  );
}

export function TakeawayCard({ takeaway }: { takeaway: SourceTakeawayDTO }) {
  return (
    <View style={s.takeawayCard}>
      <Text style={s.takeawayTitle}>{takeaway.title}</Text>
      <Text style={s.takeawayBody}>{takeaway.body}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  sectionBlock: { marginBottom: 28 },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: colors.foreground, letterSpacing: -0.2, marginBottom: 4 },
  sectionSummary: { fontSize: 13, color: colors.muted, lineHeight: 19, marginBottom: 10 },
  itemList: { gap: 8 },
  citationCard: { backgroundColor: colors.card, borderRadius: 10, borderWidth: 1, borderColor: colors.border, padding: 12, gap: 6 },
  infoBadge: { alignSelf: "flex-start", backgroundColor: colors.secondary, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  infoBadgeText: { fontSize: 10, fontWeight: "600", color: colors.primary, textTransform: "capitalize" },
  citationText: { fontSize: 14, lineHeight: 21, color: colors.foreground },
  contextText: { fontSize: 13, lineHeight: 19, color: colors.muted, fontStyle: "italic" },
  speakerText: { fontSize: 12, color: colors.muted },
  attachedCapture: { marginTop: 8, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8, gap: 4 },
  attachedCaptureLabel: { fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.8, color: colors.primary },
  attachedCaptureText: { fontSize: 13, lineHeight: 20, color: colors.foreground },
  captureCard: { backgroundColor: colors.card, borderRadius: 10, borderWidth: 1, borderColor: colors.border, borderLeftWidth: 3, borderLeftColor: colors.primary, padding: 12, gap: 6 },
  takeawayCard: { backgroundColor: colors.card, borderRadius: 10, borderWidth: 1, borderColor: colors.border, padding: 14, gap: 6 },
  takeawayTitle: { fontSize: 15, fontWeight: "700", color: colors.foreground },
  takeawayBody: { fontSize: 14, lineHeight: 21, color: colors.foreground },
});
