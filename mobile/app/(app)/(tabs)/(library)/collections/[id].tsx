import type { CollectionDTO } from "@/lib/api/rag-generated";
import type { SourceDTO } from "@/features/sources/api";
import { useSources } from "@/features/sources/hooks";
import { useCollection, useCollectionSourceIds } from "@/features/collections/hooks";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft } from "phosphor-react-native/src/icons/ArrowLeft";
import {
  ActivityIndicator,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useMemo } from "react";

const colors = {
  background: "#FAF5EB",
  card: "#FCFCF5",
  foreground: "#2C2C2C",
  muted: "#666050",
  border: "#C9C0A8",
  secondary: "#E4DBC5",
  primary: "#3F6B51",
};

function formatMeta(source: SourceDTO): string {
  const parts: string[] = [];
  if (source.type) parts.push(source.type.charAt(0).toUpperCase() + source.type.slice(1));
  if (source.author) parts.push(source.author);
  return parts.join(" · ");
}

export default function CollectionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const collectionId = id ? parseInt(id, 10) : null;
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const { data: collection, isLoading: collectionLoading, error } = useCollection(collectionId);
  const { data: sourceIds, isLoading: idsLoading } = useCollectionSourceIds(collectionId);
  const { data: allSources, isLoading: sourcesLoading } = useSources();

  const collectionSources = useMemo(() => {
    if (!sourceIds || !allSources) return [];
    const idSet = new Set(sourceIds);
    return allSources.filter((s) => idSet.has(s.id));
  }, [sourceIds, allSources]);

  const isLoading = collectionLoading || idsLoading || sourcesLoading;

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <ArrowLeft size={22} color={colors.foreground} weight="regular" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {collection?.name || "Collection"}
        </Text>
        <View style={{ width: 36 }} />
      </View>

      {isLoading && <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />}
      {error && <Text style={styles.error}>{(error as Error).message}</Text>}

      {collection && (
        <FlatList
          data={collectionSources}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <CollectionHeader collection={collection} sourceCount={collectionSources.length} />
          }
          renderItem={({ item }) => (
            <SourceRow source={item} onPress={() => router.push(`/sources/${item.id}`)} />
          )}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
    </View>
  );
}

function CollectionHeader({ collection, sourceCount }: { collection: CollectionDTO; sourceCount: number }) {
  return (
    <View style={styles.collectionHeader}>
      <View style={styles.collectionIcon}>
        <Text style={styles.collectionIconText}>{collection.name.slice(0, 1).toUpperCase()}</Text>
      </View>
      <Text style={styles.collectionName}>{collection.name}</Text>
      {collection.description ? (
        <Text style={styles.collectionDescription}>{collection.description}</Text>
      ) : null}
      <View style={styles.statRow}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{sourceCount}</Text>
          <Text style={styles.statLabel}>Sources</Text>
        </View>
      </View>
      <View style={styles.divider} />
      <Text style={styles.sectionLabel}>Sources</Text>
    </View>
  );
}

function SourceRow({ source, onPress }: { source: SourceDTO; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.75}>
      {source.image_url ? (
        <Image source={{ uri: source.image_url }} style={styles.thumb} resizeMode="cover" />
      ) : (
        <View style={[styles.thumb, styles.thumbPlaceholder]}>
          <Text style={styles.thumbPlaceholderText}>{source.type?.slice(0, 1).toUpperCase() ?? "?"}</Text>
        </View>
      )}
      <View style={styles.rowContent}>
        <Text style={styles.sourceTitle} numberOfLines={2}>{source.title}</Text>
        <Text style={styles.metaText} numberOfLines={1}>{formatMeta(source)}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: "600",
    color: colors.foreground,
    textAlign: "center",
    marginHorizontal: 8,
  },

  list: { paddingBottom: 60 },
  separator: { height: 1, backgroundColor: colors.border, marginLeft: 76 },

  collectionHeader: {
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 16,
    alignItems: "center",
  },
  collectionIcon: {
    width: 72,
    height: 72,
    borderRadius: 18,
    backgroundColor: colors.secondary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  collectionIconText: { fontSize: 30, fontWeight: "700", color: colors.muted },
  collectionName: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.foreground,
    textAlign: "center",
    letterSpacing: -0.4,
    marginBottom: 6,
  },
  collectionDescription: {
    fontSize: 14,
    color: colors.muted,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 16,
  },
  statRow: {
    flexDirection: "row",
    gap: 32,
    marginBottom: 20,
  },
  stat: { alignItems: "center", gap: 2 },
  statValue: { fontSize: 20, fontWeight: "700", color: colors.foreground },
  statLabel: { fontSize: 11, color: colors.muted, fontWeight: "500" },
  divider: { width: "100%", height: 1, backgroundColor: colors.border, marginBottom: 16 },
  sectionLabel: {
    alignSelf: "flex-start",
    fontSize: 13,
    fontWeight: "700",
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 20,
    gap: 12,
    backgroundColor: colors.background,
  },
  thumb: { width: 52, height: 52, borderRadius: 8, flexShrink: 0 },
  thumbPlaceholder: { backgroundColor: colors.secondary, alignItems: "center", justifyContent: "center" },
  thumbPlaceholderText: { fontSize: 18, fontWeight: "600", color: colors.muted },
  rowContent: { flex: 1, gap: 3 },
  sourceTitle: { fontSize: 14, fontWeight: "500", color: colors.foreground, lineHeight: 19 },
  metaText: { fontSize: 11, color: colors.muted },

  error: { color: "red", margin: 24 },
});
