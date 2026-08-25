import type { CollectionDTO } from "@/lib/api/rag-generated";
import { CaretRight } from "phosphor-react-native/src/icons/CaretRight";
import { Folder } from "phosphor-react-native/src/icons/Folder";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

const colors = {
  foreground: "#2C2C2C",
  muted: "#666050",
  primary: "#3F6B51",
  secondary: "#E4DBC5",
};

export interface CollectionRowProps {
  collection: CollectionDTO;
  onPress: () => void;
}

export function CollectionRow({ collection, onPress }: CollectionRowProps) {
  const count = collection.source_count ?? 0;
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.75}>
      <View style={styles.iconWrap}>
        <Folder size={20} color={colors.primary} weight="regular" />
      </View>
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>{collection.name}</Text>
        {collection.description ? (
          <Text style={styles.description} numberOfLines={1}>{collection.description}</Text>
        ) : null}
        <Text style={styles.count}>
          {count} source{count === 1 ? "" : "s"}
        </Text>
      </View>
      <CaretRight size={16} color={colors.muted} weight="bold" />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 14,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.secondary,
    alignItems: "center",
    justifyContent: "center",
  },
  body: { flex: 1, gap: 3, justifyContent: "center" },
  title: { fontSize: 15, fontWeight: "600", color: colors.foreground, lineHeight: 19 },
  description: { fontSize: 12, color: colors.muted, lineHeight: 16 },
  count: { fontSize: 11, color: colors.muted, fontWeight: "600" },
});
