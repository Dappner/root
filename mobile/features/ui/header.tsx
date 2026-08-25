import { appTheme } from "@/features/ui/theme";
import { useRouter } from "expo-router";
import type { ReactNode } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

export function BackButton({ label = "‹ Back" }: { label?: string }) {
  const router = useRouter();
  return (
    <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
      <Text style={styles.backText}>{label}</Text>
    </TouchableOpacity>
  );
}

export function PageHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  return (
    <View style={styles.header}>
      <View style={styles.headerText}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  backButton: {
    alignSelf: "flex-start",
    marginBottom: appTheme.space.lg,
  },
  backText: {
    fontSize: 16,
    color: appTheme.color.primary,
    fontWeight: "600",
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: appTheme.space.lg,
    marginBottom: appTheme.space.xxl,
  },
  headerText: {
    flex: 1,
    gap: appTheme.space.xs,
  },
  title: {
    ...appTheme.typography.pageTitle,
    color: appTheme.color.foreground,
  },
  subtitle: {
    ...appTheme.typography.body,
    color: appTheme.color.muted,
  },
});
