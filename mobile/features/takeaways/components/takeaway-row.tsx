import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Lightbulb } from "phosphor-react-native/src/icons/Lightbulb";
import { DotsThree } from "phosphor-react-native/src/icons/DotsThree";
import { appTheme } from "@/features/ui";
import type { TakeawayResponse } from "../types";

const colors = appTheme.color;

function formatRelativeDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const dayMs = 86_400_000;
  if (diffMs < dayMs && now.getDate() === d.getDate()) return "Today";
  if (diffMs < 2 * dayMs) return "Yesterday";
  const diffDays = Math.floor(diffMs / dayMs);
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export interface TakeawayRowProps {
  takeaway?: TakeawayResponse | null;
  onPress: () => void;
}

export function TakeawayRow({ takeaway, onPress }: TakeawayRowProps) {
  if (!takeaway) return null;

  const sourceTitle = takeaway.source?.title ?? "Untitled source";
  const sourceImage = takeaway.source?.image_url;
  const updatedAt = takeaway.updated_at ?? takeaway.created_at;
  const dateLabel = updatedAt ? formatRelativeDate(updatedAt) : "";

  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.85} onPress={onPress}>
      <View style={styles.topRow}>
        <View style={styles.badge}>
          <Lightbulb size={20} color={colors.primary} weight="regular" />
        </View>
        <View style={styles.body}>
          <View style={styles.headerRow}>
            <Text style={styles.title} numberOfLines={2}>
              {takeaway.title || "Untitled takeaway"}
            </Text>
            <View style={styles.headerMeta}>
              {!!dateLabel && <Text style={styles.date}>{dateLabel}</Text>}
              <TouchableOpacity
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                onPress={(e) => e.stopPropagation()}
              >
                <DotsThree size={18} color={colors.muted} weight="bold" />
              </TouchableOpacity>
            </View>
          </View>
          {!!takeaway.body && (
            <Text style={styles.excerpt} numberOfLines={3}>
              {takeaway.body}
            </Text>
          )}
        </View>
      </View>
      <View style={styles.footer}>
        {sourceImage ? (
          <Image source={{ uri: sourceImage }} style={styles.sourceThumb} />
        ) : (
          <View style={[styles.sourceThumb, styles.sourceThumbPlaceholder]}>
            <Text style={styles.sourceThumbText}>
              {sourceTitle.slice(0, 1).toUpperCase()}
            </Text>
          </View>
        )}
        <Text style={styles.sourceTitle} numberOfLines={1}>
          {sourceTitle}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 12,
  },
  topRow: { flexDirection: "row", gap: 12 },
  badge: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.borderSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  body: { flex: 1, gap: 6 },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  title: {
    flex: 1,
    fontSize: 15,
    fontWeight: "700",
    color: colors.foreground,
    lineHeight: 20,
    letterSpacing: -0.2,
  },
  headerMeta: { flexDirection: "row", alignItems: "center", gap: 6 },
  date: { fontSize: 11, color: colors.muted },
  excerpt: { fontSize: 13, color: colors.muted, lineHeight: 18 },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  sourceThumb: { width: 22, height: 22, borderRadius: 5 },
  sourceThumbPlaceholder: {
    backgroundColor: colors.borderSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  sourceThumbText: { fontSize: 11, fontWeight: "700", color: colors.muted },
  sourceTitle: {
    flex: 1,
    fontSize: 12,
    fontWeight: "600",
    color: colors.foreground,
  },
});
