import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import type { SourceDTO, SourceTakeawayDTO } from "../../api";
import { PendingVoiceNotesCallout } from "@/features/offline";
import { ActivityRow } from "./activity-row";
import { TakeawayRow } from "./takeaway-row";
import type { HubActivityItem } from "../../hooks/use-source-hub-data";
import { colors } from "./theme";

export interface OverviewTabProps {
  source: SourceDTO;
  recentActivity: HubActivityItem[];
  takeaways: SourceTakeawayDTO[];
  totalHighlights: number;
  reviewableSuggestionCount: number;
  onViewAllHighlights: () => void;
}

export function OverviewTab({
  source,
  recentActivity,
  takeaways,
  totalHighlights,
  reviewableSuggestionCount,
  onViewAllHighlights,
}: OverviewTabProps) {
  const router = useRouter();
  const sourceId = source.id;

  return (
    <View style={styles.tabContent}>
      <PendingVoiceNotesCallout sourceId={sourceId} />

      {(source.summary_short || source.summary_long) && (
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Summary</Text>
          <Text style={styles.summaryText}>
            {source.summary_short ?? source.summary_long}
          </Text>
        </View>
      )}

      {recentActivity.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent activity</Text>
            {totalHighlights > 3 && (
              <TouchableOpacity onPress={onViewAllHighlights}>
                <Text style={styles.sectionViewAll}>View all</Text>
              </TouchableOpacity>
            )}
          </View>
          <View style={styles.activityList}>
            {recentActivity.map((a, i) => (
              <ActivityRow key={i} activity={a} />
            ))}
          </View>
        </View>
      )}

      {takeaways.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Key takeaways</Text>
            {takeaways.length > 3 && (
              <TouchableOpacity onPress={() => router.push(`/sources/${sourceId}/takeaways`)}>
                <Text style={styles.sectionViewAll}>View all</Text>
              </TouchableOpacity>
            )}
          </View>
          <View style={styles.takeawayList}>
            {takeaways.slice(0, 3).map((t, i) => (
              <TakeawayRow key={t.id} takeaway={t} index={i} />
            ))}
          </View>
        </View>
      )}

      {reviewableSuggestionCount > 0 && (
        <TouchableOpacity
          style={styles.suggestionNudge}
          onPress={() => router.push(`/sources/${sourceId}/suggestions`)}
          activeOpacity={0.8}
        >
          <Text style={styles.suggestionNudgeText}>
            ◌ {reviewableSuggestionCount} suggestion{reviewableSuggestionCount !== 1 ? "s" : ""} to review
          </Text>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>
      )}

      {recentActivity.length === 0 && takeaways.length === 0 && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No highlights or takeaways yet.</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  tabContent: { paddingHorizontal: 24, paddingTop: 20, gap: 12 },

  summaryCard: {
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 6,
  },
  summaryTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  summaryText: { fontSize: 14, color: colors.foreground, lineHeight: 20 },

  section: { gap: 10 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: colors.foreground },
  sectionViewAll: { fontSize: 13, color: colors.primary, fontWeight: "500" },

  activityList: { gap: 1, borderRadius: 14, borderWidth: 1, borderColor: colors.border, overflow: "hidden" },
  takeawayList: { gap: 1, borderRadius: 14, borderWidth: 1, borderColor: colors.border, overflow: "hidden" },

  chevron: { fontSize: 20, color: colors.muted },

  suggestionNudge: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  suggestionNudgeText: { fontSize: 14, color: colors.primary, fontWeight: "500" },

  emptyState: { paddingVertical: 40, alignItems: "center" },
  emptyText: { fontSize: 14, color: colors.muted },
});
