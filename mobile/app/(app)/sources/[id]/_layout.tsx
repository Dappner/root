import { Stack } from "expo-router";
import { View } from "react-native";
import { AppTabBar } from "@/features/navigation/app-tab-bar";

export default function SourceSubLayout() {
  return (
    <View style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false }} />
      <AppTabBar />
    </View>
  );
}
