import type { ReactNode } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { CaretRight } from "phosphor-react-native/src/icons/CaretRight";
import { appTheme } from "@/features/ui";

const colors = appTheme.color;

export interface ShelfProps {
  title: string;
  /** When provided, renders a tappable header (title + chevron). */
  onSeeAll?: () => void;
  children: ReactNode;
}

/**
 * A labelled horizontal carousel row. The section title scrolls with the page;
 * its contents scroll sideways. Keeps vertical chrome to a single header line.
 */
export function Shelf({ title, onSeeAll, children }: ShelfProps) {
  return (
    <View style={styles.shelf}>
      <TouchableOpacity
        style={styles.header}
        onPress={onSeeAll}
        disabled={!onSeeAll}
        activeOpacity={onSeeAll ? 0.6 : 1}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Text style={styles.title}>{title}</Text>
        {onSeeAll && <CaretRight size={16} color={colors.muted} weight="bold" />}
      </TouchableOpacity>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.carousel}
      >
        {children}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  shelf: { marginBottom: 24 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  title: { fontSize: 20, fontWeight: "700", color: colors.foreground, letterSpacing: -0.4 },
  carousel: { paddingHorizontal: 20, gap: 12 },
});
