import { appTheme } from "@/features/ui/theme";
import type { ReactNode } from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, type GestureResponderEvent } from "react-native";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

export function AppButton({
  label,
  onPress,
  variant = "primary",
  disabled = false,
  loading = false,
  icon,
}: {
  label: string;
  onPress?: (event: GestureResponderEvent) => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  icon?: ReactNode;
}) {
  const colors = variantColors[variant];
  return (
    <TouchableOpacity
      style={[
        styles.button,
        { backgroundColor: colors.background, borderColor: colors.border },
        disabled && styles.disabled,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.82}
    >
      {loading ? <ActivityIndicator color={colors.text} size="small" /> : icon}
      <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const variantColors: Record<ButtonVariant, { background: string; border: string; text: string }> = {
  primary: {
    background: appTheme.color.primary,
    border: appTheme.color.primary,
    text: appTheme.color.primaryForeground,
  },
  secondary: {
    background: appTheme.color.borderSoft,
    border: appTheme.color.borderSoft,
    text: appTheme.color.foreground,
  },
  ghost: {
    background: "transparent",
    border: "transparent",
    text: appTheme.color.primary,
  },
  danger: {
    background: appTheme.color.danger,
    border: appTheme.color.danger,
    text: appTheme.color.primaryForeground,
  },
};

const styles = StyleSheet.create({
  button: {
    minHeight: 44,
    borderRadius: appTheme.radius.lg,
    borderWidth: 1,
    paddingHorizontal: appTheme.space.lg,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: appTheme.space.sm,
  },
  label: {
    fontSize: 14,
    fontWeight: "700",
  },
  disabled: {
    opacity: 0.5,
  },
});
