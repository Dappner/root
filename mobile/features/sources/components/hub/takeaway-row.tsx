import { StyleSheet, Text, View } from "react-native";
import type { SourceTakeawayDTO } from "../../api";
import { colors } from "./theme";

export function TakeawayRow({ takeaway, index }: { takeaway: SourceTakeawayDTO; index: number }) {
  return (
    <View style={styles.takeawayRow}>
      <View style={styles.takeawayIndex}>
        <Text style={styles.takeawayIndexText}>{index + 1}</Text>
      </View>
      <Text style={styles.takeawayText} numberOfLines={3}>{takeaway.body}</Text>
      <Text style={styles.chevron}>›</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  takeawayRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    padding: 14,
    gap: 12,
  },
  takeawayIndex: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: colors.secondary,
    alignItems: "center", justifyContent: "center",
  },
  takeawayIndexText: { fontSize: 12, fontWeight: "700", color: colors.primary },
  takeawayText: { flex: 1, fontSize: 14, color: colors.foreground, lineHeight: 20 },
  chevron: { fontSize: 20, color: colors.muted },
});
