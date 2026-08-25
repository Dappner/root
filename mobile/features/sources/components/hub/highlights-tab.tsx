import { StyleSheet, Text, View } from "react-native";
import type { GroupedSection } from "../highlights";
import { HubCaptureCard, HubHighlightCard } from "./hub-highlight-card";
import { colors } from "./theme";

export interface HighlightsTabProps {
  groups: GroupedSection[];
  totalHighlights: number;
}

export function HighlightsTab({ groups, totalHighlights }: HighlightsTabProps) {
  return (
    <View style={styles.tabContent}>
      {totalHighlights === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No highlights yet.</Text>
        </View>
      ) : (
        groups.map((group, gi) => (
          <View key={group.section?.id ?? "unsorted"} style={gi > 0 ? styles.sectionGroup : undefined}>
            {group.section?.title && (
              <Text style={styles.sectionGroupTitle}>{group.section.title}</Text>
            )}
            {group.citationsWithCaptures.map(({ citation, captures }) => (
              <HubHighlightCard key={`cit-${citation.id}`} citation={citation} captures={captures} />
            ))}
            {group.standaloneCaptures.map((cap) => (
              <HubCaptureCard key={`cap-${cap.id}`} capture={cap} />
            ))}
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  tabContent: { paddingHorizontal: 24, paddingTop: 20, gap: 12 },
  sectionGroup: { marginTop: 20 },
  sectionGroupTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  emptyState: { paddingVertical: 40, alignItems: "center" },
  emptyText: { fontSize: 14, color: colors.muted },
});
