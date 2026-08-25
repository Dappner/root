import { ScrollView, StyleSheet, Text, TouchableOpacity } from "react-native";
import { colors } from "./theme";

export type HubTab = "overview" | "highlights" | "transcript" | "notes";

export interface HubTabBarProps {
  tabs: { key: HubTab; label: string; count?: number }[];
  activeTab: HubTab;
  onChange: (tab: HubTab) => void;
}

export function HubTabBar({ tabs, activeTab, onChange }: HubTabBarProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.tabBar}
      contentContainerStyle={styles.tabBarContent}
    >
      {tabs.map((tab) => (
        <TouchableOpacity
          key={tab.key}
          style={[styles.tab, activeTab === tab.key && styles.tabActive]}
          onPress={() => onChange(tab.key)}
          activeOpacity={0.7}
        >
          <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
            {tab.label}
            {tab.count != null && tab.count > 0 ? ` ${tab.count}` : ""}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  tabBar: { borderBottomWidth: 1, borderBottomColor: colors.border, marginBottom: 0 },
  tabBarContent: { paddingHorizontal: 24, gap: 0 },
  tab: { paddingVertical: 10, paddingHorizontal: 14, borderBottomWidth: 2, borderBottomColor: "transparent", marginBottom: -1 },
  tabActive: { borderBottomColor: colors.primary },
  tabText: { fontSize: 14, fontWeight: "500", color: colors.muted },
  tabTextActive: { color: colors.primary, fontWeight: "600" },
});
