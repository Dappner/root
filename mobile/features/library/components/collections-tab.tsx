import { ActivityIndicator, FlatList, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import type { CollectionDTO } from "@/lib/api/rag-generated";
import { CollectionRow } from "@/features/collections/components/collection-row";
import { colors } from "../theme";

export interface CollectionsTabProps {
  loading: boolean;
  collections: CollectionDTO[];
}

export function CollectionsTab({ loading, collections }: CollectionsTabProps) {
  const router = useRouter();
  return (
    <>
      {loading && <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />}
      {collections.length === 0 && !loading && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No collections yet.</Text>
        </View>
      )}
      <FlatList
        data={collections}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <CollectionRow
            collection={item}
            onPress={() => router.push(`/(app)/(tabs)/(library)/collections/${item.id}`)}
          />
        )}
        ItemSeparatorComponent={() => <View style={styles.rowSeparator} />}
      />
    </>
  );
}

const styles = StyleSheet.create({
  list: { paddingBottom: 120 },
  rowSeparator: { height: 1, backgroundColor: colors.borderSoft, marginHorizontal: 16 },
  emptyState: { alignItems: "center", paddingTop: 60, paddingHorizontal: 20 },
  emptyText: { fontSize: 14, color: colors.muted, textAlign: "center" },
});
