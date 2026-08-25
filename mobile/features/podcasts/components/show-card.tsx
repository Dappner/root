import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { appTheme } from "@/features/ui";

const colors = appTheme.color;

export const SHOW_CARD_WIDTH = 140;

export interface ShowCardProps {
  title: string;
  imageUrl?: string | null;
  subtitle?: string | null;
  onPress: () => void;
}

/** Square artwork tile for a podcast show, used in horizontal shelves. */
export function ShowCard({ title, imageUrl, subtitle, onPress }: ShowCardProps) {
  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.85} onPress={onPress}>
      {imageUrl ? (
        <Image source={{ uri: imageUrl }} style={styles.art} resizeMode="cover" />
      ) : (
        <View style={[styles.art, styles.artPlaceholder]}>
          <Text style={styles.artPlaceholderText}>{title.slice(0, 1).toUpperCase()}</Text>
        </View>
      )}
      <Text style={styles.title} numberOfLines={2}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text> : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: { width: SHOW_CARD_WIDTH, gap: 6 },
  art: { width: SHOW_CARD_WIDTH, height: SHOW_CARD_WIDTH, borderRadius: 12 },
  artPlaceholder: { backgroundColor: colors.borderSoft, alignItems: "center", justifyContent: "center" },
  artPlaceholderText: { fontSize: 40, fontWeight: "700", color: colors.muted },
  title: { fontSize: 14, fontWeight: "600", color: colors.foreground, lineHeight: 18 },
  subtitle: { fontSize: 12, color: colors.muted },
});
