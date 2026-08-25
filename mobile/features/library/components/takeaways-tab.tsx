import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { useMemo } from "react";
import { ArrowsDownUp } from "phosphor-react-native/src/icons/ArrowsDownUp";
import { CaretDown } from "phosphor-react-native/src/icons/CaretDown";
import { TakeawayRow } from "@/features/takeaways/components/takeaway-row";
import { useRecentTakeaways } from "@/features/takeaways/hooks";
import { colors } from "../theme";

export function TakeawaysTab() {
  const router = useRouter();
  const { data: takeaways = [], isLoading } = useRecentTakeaways(50, 0);
  const visibleTakeaways = useMemo(
    () =>
      takeaways.filter(
        (takeaway) => takeaway?.id != null && takeaway.source?.id != null,
      ),
    [takeaways],
  );

  return (
    <>
      <View style={styles.filterRow}>
        <FilterChip icon={<ArrowsDownUp size={14} color={colors.foreground} weight="regular" />} label="Recent" />
      </View>

      {isLoading && <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />}
      {!isLoading && visibleTakeaways.length === 0 && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No takeaways yet.</Text>
        </View>
      )}
      <FlatList
        data={visibleTakeaways}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        renderItem={({ item }) => (
          <TakeawayRow
            takeaway={item}
            onPress={() => router.push(`/sources/${item.source.id}/takeaways`)}
          />
        )}
      />
    </>
  );
}

function FilterChip({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <TouchableOpacity style={styles.chip} activeOpacity={0.85}>
      {icon}
      <Text style={styles.chipLabel}>{label}</Text>
      <CaretDown size={11} color={colors.muted} weight="bold" />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  filterRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  chipLabel: { fontSize: 12, fontWeight: "500", color: colors.foreground },
  list: { paddingHorizontal: 16, paddingBottom: 120 },
  separator: { height: 10 },
  emptyState: { alignItems: "center", paddingTop: 60, paddingHorizontal: 20 },
  emptyText: { fontSize: 14, color: colors.muted, textAlign: "center" },
});
