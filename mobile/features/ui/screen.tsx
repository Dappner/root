import { appTheme } from "@/features/ui/theme";
import type { ReactNode } from "react";
import { ScrollView, StyleSheet, View, type ScrollViewProps, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type AppScreenProps = {
  children: ReactNode;
  padded?: boolean;
  scroll?: boolean;
  bottomInset?: number;
  style?: ViewStyle;
  contentStyle?: ViewStyle;
  scrollProps?: Omit<ScrollViewProps, "style" | "contentContainerStyle">;
};

export function AppScreen({
  children,
  padded = true,
  scroll = false,
  bottomInset = 120,
  style,
  contentStyle,
  scrollProps,
}: AppScreenProps) {
  const insets = useSafeAreaInsets();
  const content = [
    padded && styles.padded,
    { paddingTop: insets.top + appTheme.space.lg, paddingBottom: bottomInset },
    contentStyle,
  ];

  if (scroll) {
    return (
      <ScrollView
        style={[styles.screen, style]}
        contentContainerStyle={content}
        showsVerticalScrollIndicator={false}
        {...scrollProps}
      >
        {children}
      </ScrollView>
    );
  }

  return <View style={[styles.screen, content, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: appTheme.color.background,
  },
  padded: {
    paddingHorizontal: appTheme.space.xxl,
  },
});
