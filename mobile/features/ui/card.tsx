import { appTheme } from "@/features/ui/theme";
import type { ReactNode } from "react";
import { StyleSheet, View, type ViewStyle } from "react-native";

export function AppCard({
  children,
  style,
}: {
  children: ReactNode;
  style?: ViewStyle;
}) {
  return <View style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: appTheme.color.surface,
    borderColor: appTheme.color.border,
    borderWidth: 1,
    borderRadius: appTheme.radius.xl,
  },
});
