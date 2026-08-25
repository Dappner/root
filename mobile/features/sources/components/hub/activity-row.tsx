import { StyleSheet, Text, View } from "react-native";
import type { CitationResponse as CitationDTO } from "@/lib/api/rag-generated";
import { formatRelativeDate, formatTimestamp } from "@/lib/utils";
import type { HubActivityItem } from "../../hooks/use-source-hub-data";
import { colors } from "./theme";

export function ActivityRow({ activity }: { activity: HubActivityItem }) {
  const { kind, item } = activity;
  const isCitation = kind === "citation";
  const citation = isCitation ? (item as CitationDTO) : null;
  const location = citation?.location;
  const tStartSec =
    location && location.type === "av_v1" ? location.av?.tStartSec : undefined;

  return (
    <View style={styles.activityRow}>
      <View style={[styles.activityIcon, { backgroundColor: isCitation ? "#FEF3C7" : colors.primaryLight }]}>
        <Text style={styles.activityIconText}>{isCitation ? "✦" : "◎"}</Text>
      </View>
      <View style={styles.activityBody}>
        <Text style={styles.activityLabel}>{isCitation ? "Highlighted" : "Captured a thought"}</Text>
        <Text style={styles.activityText} numberOfLines={2}>"{item.text}"</Text>
        <View style={styles.activityMeta}>
          <Text style={styles.activityDate}>{formatRelativeDate(item.created_at)}</Text>
          {tStartSec != null && (
            <Text style={styles.activityTimestamp}> · {formatTimestamp(tStartSec)}</Text>
          )}
        </View>
      </View>
      <Text style={styles.chevron}>›</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  activityRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    padding: 14,
    gap: 12,
  },
  activityIcon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  activityIconText: { fontSize: 14, color: colors.primary },
  activityBody: { flex: 1, gap: 2 },
  activityLabel: { fontSize: 12, fontWeight: "600", color: colors.foreground },
  activityText: { fontSize: 13, color: colors.muted, lineHeight: 18 },
  activityMeta: { flexDirection: "row", marginTop: 2 },
  activityDate: { fontSize: 11, color: colors.muted },
  activityTimestamp: { fontSize: 11, color: colors.muted },
  chevron: { fontSize: 20, color: colors.muted },
});
