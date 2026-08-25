import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { colors } from "../theme";

export type LibTab = "sources" | "notes" | "takeaways" | "collections";

const TABS: { key: LibTab; label: string }[] = [
  { key: "sources", label: "Sources" },
  { key: "notes", label: "Notes" },
  { key: "takeaways", label: "Takeaways" },
  { key: "collections", label: "Collections" },
];

export interface TabSwitcherProps {
  activeTab: LibTab;
  onChange: (tab: LibTab) => void;
}

export function TabSwitcher({ activeTab, onChange }: TabSwitcherProps) {
  return (
    <View style={styles.tabSwitcher}>
      {TABS.map((tab) => (
        <TouchableOpacity
          key={tab.key}
          style={[styles.tabBtn, activeTab === tab.key && styles.tabBtnActive]}
          onPress={() => onChange(tab.key)}
          activeOpacity={0.75}
        >
          <Text style={[styles.tabBtnText, activeTab === tab.key && styles.tabBtnTextActive]}>
            {tab.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  tabSwitcher: {
    flexDirection: "row",
    marginHorizontal: 20,
    marginBottom: 12,
    backgroundColor: colors.card,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 3,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: 20,
  },
  tabBtnActive: { backgroundColor: colors.foreground },
  tabBtnText: { fontSize: 14, fontWeight: "500", color: colors.muted },
  tabBtnTextActive: { color: "#fff", fontWeight: "600" },
});
