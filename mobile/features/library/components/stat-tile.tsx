import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { colors } from "../theme";

export interface StatTileProps {
  label: string;
  count: number;
  icon: React.ReactNode;
  active: boolean;
  onPress: () => void;
}

export function StatTile({ label, count, icon, active, onPress }: StatTileProps) {
  return (
    <TouchableOpacity
      style={[styles.statTile, active && styles.statTileActive]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={styles.statTileIcon}>{icon}</View>
      <Text style={styles.statTileLabel} numberOfLines={1}>{label}</Text>
      <Text style={styles.statTileCount}>{count}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  statTile: {
    width: 78,
    paddingVertical: 8,
    paddingHorizontal: 8,
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    gap: 3,
  },
  statTileActive: {
    borderColor: colors.foreground,
    borderWidth: 2,
    backgroundColor: "#F2EBD7",
  },
  statTileIcon: { height: 18, alignItems: "center", justifyContent: "center" },
  statTileLabel: {
    fontSize: 10.5,
    color: colors.muted,
    fontWeight: "500",
    textAlign: "center",
  },
  statTileCount: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.foreground,
    lineHeight: 18,
  },
});
