import { Tabs } from "expo-router";
import { AppTabBar } from "@/features/navigation/app-tab-bar";

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={() => <AppTabBar />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index" options={{ href: null }} />
      <Tabs.Screen name="(ask)" options={{ title: "Ask" }} />
      <Tabs.Screen name="(podcasts)" options={{ title: "Podcasts" }} />
      <Tabs.Screen name="(home)" options={{ title: "Home" }} />
      <Tabs.Screen name="(library)" options={{ title: "Library" }} />
      <Tabs.Screen name="(settings)" options={{ title: "Settings" }} />
    </Tabs>
  );
}
