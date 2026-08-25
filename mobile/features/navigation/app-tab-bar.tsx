import { useRouter, useSegments } from "expo-router";
import { Question } from "phosphor-react-native/src/icons/Question";
import { Microphone } from "phosphor-react-native/src/icons/Microphone";
import { House } from "phosphor-react-native/src/icons/House";
import { List } from "phosphor-react-native/src/icons/List";
import { Gear } from "phosphor-react-native/src/icons/Gear";
import type { ComponentType } from "react";
import { Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const colors = {
  background: "#FAF5EB",
  border: "#C9C0A8",
  muted: "#9E9580",
  active: "#2C2C2C",
};

export const TAB_HEIGHT = Platform.OS === "ios" ? 49 : 56;

type TabDef = {
  href: string;
  segment: string;
  label: string;
  Icon: ComponentType<{ size: number; color: string; weight?: "regular" | "fill" }>;
};

const TABS: TabDef[] = [
  { href: "/(app)/(tabs)/(ask)",      segment: "(ask)",      label: "Ask",      Icon: Question },
  { href: "/(app)/(tabs)/(podcasts)", segment: "(podcasts)", label: "Podcasts", Icon: Microphone },
  { href: "/(app)/(tabs)/(home)",     segment: "(home)",     label: "Home",     Icon: House },
  { href: "/(app)/(tabs)/(library)",  segment: "(library)",  label: "Library",  Icon: List },
  { href: "/(app)/(tabs)/(settings)", segment: "(settings)", label: "Settings", Icon: Gear },
];

export function AppTabBar() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const segments = useSegments();
  const activeGroup = segments.find((s) => s.startsWith("(") && s.endsWith(")") && s !== "(app)" && s !== "(tabs)");
  const bottomPad = Platform.OS === "ios" ? insets.bottom : 0;

  return (
    <View style={{ backgroundColor: colors.background }}>
      <View style={[styles.tabBar, { paddingBottom: bottomPad, height: TAB_HEIGHT + bottomPad }]}>
        {TABS.map(({ href, segment, label, Icon }) => {
          const isFocused = activeGroup === segment;
          const color = isFocused ? colors.active : colors.muted;

          return (
            <TouchableOpacity
              key={segment}
              onPress={() => router.navigate(href as never)}
              style={styles.tab}
              activeOpacity={0.7}
            >
              <Icon size={22} color={color} weight={isFocused ? "fill" : "regular"} />
              <Text style={[styles.tabLabel, { color }]}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
    alignItems: "center",
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    paddingTop: 8,
  },
  tabLabel: { fontSize: 10, fontWeight: "500", letterSpacing: 0.2 },
});
