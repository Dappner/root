import { StyleSheet, Text, TouchableOpacity } from "react-native";
import { Check } from "phosphor-react-native/src/icons/Check";
import { DownloadSimple } from "phosphor-react-native/src/icons/DownloadSimple";
import { colors } from "../theme";

export interface FilterChipProps {
  label: string;
  active: boolean;
  onPress: () => void;
  icon: "check" | "download";
}

export function FilterChip({ label, active, onPress, icon }: FilterChipProps) {
  const iconColor = active ? "#fff" : colors.muted;
  return (
    <TouchableOpacity
      style={[styles.chip, active && styles.chipActive]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      {icon === "check" ? (
        <Check size={12} color={iconColor} weight="bold" />
      ) : (
        <DownloadSimple size={12} color={iconColor} weight="regular" />
      )}
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 18,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 12, fontWeight: "500", color: colors.muted },
  chipTextActive: { color: "#fff" },
});
