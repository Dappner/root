import { appTheme } from "@/features/ui/theme";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

export function LoadingState({ label }: { label?: string }) {
  return (
    <View style={styles.state}>
      <ActivityIndicator color={appTheme.color.primary} />
      {label ? <Text style={styles.text}>{label}</Text> : null}
    </View>
  );
}

export function EmptyState({
  title,
  message,
}: {
  title?: string;
  message: string;
}) {
  return (
    <View style={styles.state}>
      {title ? <Text style={styles.title}>{title}</Text> : null}
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <View style={styles.state}>
      <Text style={styles.error}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  state: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
    paddingHorizontal: appTheme.space.xl,
    gap: appTheme.space.sm,
  },
  title: {
    ...appTheme.typography.sectionTitle,
    color: appTheme.color.foreground,
    textAlign: "center",
  },
  text: {
    ...appTheme.typography.body,
    color: appTheme.color.muted,
    textAlign: "center",
  },
  error: {
    ...appTheme.typography.body,
    color: appTheme.color.danger,
    textAlign: "center",
  },
});
