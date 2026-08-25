import { MiniPlayer } from "@/features/player/mini-player";
import { usePlayer } from "@/features/player/context";
import { TAB_HEIGHT } from "@/features/navigation/app-tab-bar";
import { useIsOnline, useOfflineStore, useOnReconnect } from "@/features/offline";
import { Stack, usePathname } from "expo-router";
import { useEffect } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppState, StyleSheet, Text, View } from "react-native";

function MiniPlayerShell() {
  const { track } = usePlayer();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();

  if (!track || pathname === "/player") return null;

  // The tab bar is now rendered everywhere except the full-screen player, so
  // always reserve TAB_HEIGHT to keep the mini-player above it.
  const bottom = insets.bottom + TAB_HEIGHT;

  return (
    <View style={{ position: "absolute", left: 0, right: 0, bottom }} pointerEvents="box-none">
      <MiniPlayer />
    </View>
  );
}

function OfflineBanner() {
  const insets = useSafeAreaInsets();
  const isOnline = useIsOnline();
  if (isOnline) return null;
  return (
    <View style={[styles.banner, { paddingTop: insets.top + 2 }]} pointerEvents="none">
      <Text style={styles.bannerText}>Offline · changes will sync when reconnected</Text>
    </View>
  );
}

export default function AppLayout() {
  const { processOutbox } = useOfflineStore();

  useEffect(() => {
    void processOutbox();
    const sub = AppState.addEventListener("change", (next) => {
      if (next === "active") void processOutbox();
    });
    return () => sub.remove();
  }, [processOutbox]);

  useOnReconnect(processOutbox);

  return (
    <View style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="sources/[id]"
          options={{ animation: "slide_from_right", gestureEnabled: true, fullScreenGestureEnabled: true }}
        />
        <Stack.Screen
          name="player"
          options={{ animation: "slide_from_bottom", gestureEnabled: true, fullScreenGestureEnabled: true }}
        />
      </Stack>
      <OfflineBanner />
      <MiniPlayerShell />
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    alignItems: "center",
    paddingBottom: 4,
    backgroundColor: "#3F2A2A",
  },
  bannerText: {
    color: "#FFEDD8",
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.2,
  },
});
