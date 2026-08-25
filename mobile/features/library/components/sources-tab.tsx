import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { MagnifyingGlass } from "phosphor-react-native/src/icons/MagnifyingGlass";
import { X } from "phosphor-react-native/src/icons/X";
import { CaretRight } from "phosphor-react-native/src/icons/CaretRight";
import { BookmarkSimple } from "phosphor-react-native/src/icons/BookmarkSimple";
import { CircleDashed } from "phosphor-react-native/src/icons/CircleDashed";
import { Sparkle } from "phosphor-react-native/src/icons/Sparkle";
import { CheckCircle } from "phosphor-react-native/src/icons/CheckCircle";
import { SourceDTOStatus } from "@/lib/api/rag-generated";
import type { SourceDTO } from "@/features/sources/api";
import { SourceRow } from "@/features/sources/components/source-row";
import { FilterChip } from "./filter-chip";
import { StatTile } from "./stat-tile";
import { colors, SECTION_PREVIEW_COUNT, STATUS_SECTIONS } from "../theme";
import type { useLibraryFilters } from "../hooks/use-library-filters";

type FiltersState = ReturnType<typeof useLibraryFilters>;

export interface SourcesTabProps {
  loading: boolean;
  filters: FiltersState;
  onShowActions: (source: SourceDTO) => void;
}

export function SourcesTab({ loading, filters, onShowActions }: SourcesTabProps) {
  const router = useRouter();
  const {
    searchVisible,
    setSearchVisible,
    searchQuery,
    setSearchQuery,
    excludeDone,
    setExcludeDone,
    excludeInCollections,
    setExcludeInCollections,
    downloadedOnly,
    setDownloadedOnly,
    statusFilter,
    setStatusFilter,
    downloadedIds,
    baseFiltered,
    flatFiltered,
    statusCounts,
    sectionedSources,
    hasActiveFilters,
    searchActive,
    showFlatList,
  } = filters;

  return (
    <>
      {searchVisible && (
        <View style={styles.searchBar}>
          <MagnifyingGlass size={16} color={colors.muted} weight="regular" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search sources…"
            placeholderTextColor={colors.muted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery("")}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <X size={14} color={colors.muted} weight="bold" />
            </TouchableOpacity>
          )}
        </View>
      )}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
        style={styles.filterScroll}
      >
        <FilterChip
          label="Exclude done"
          icon="check"
          active={excludeDone}
          onPress={() => setExcludeDone((v) => !v)}
        />
        <FilterChip
          label="Exclude in collections"
          icon="check"
          active={excludeInCollections}
          onPress={() => setExcludeInCollections((v) => !v)}
        />
        <FilterChip
          label="Downloaded"
          icon="download"
          active={downloadedOnly}
          onPress={() => setDownloadedOnly((v) => !v)}
        />
      </ScrollView>

      {loading && <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />}
      {!loading && (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <Text style={styles.overviewLabel}>Overview</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tilesRow}
          >
            <StatTile
              label="All sources"
              count={statusCounts.total}
              icon={<BookmarkSimple size={18} color={colors.foreground} weight="regular" />}
              active={statusFilter === "all"}
              onPress={() => setStatusFilter("all")}
            />
            <StatTile
              label="To do"
              count={statusCounts[SourceDTOStatus.todo]}
              icon={<CircleDashed size={18} color={colors.dot.todo} weight="regular" />}
              active={statusFilter === SourceDTOStatus.todo}
              onPress={() => setStatusFilter(statusFilter === SourceDTOStatus.todo ? "all" : SourceDTOStatus.todo)}
            />
            <StatTile
              label="In progress"
              count={statusCounts[SourceDTOStatus.in_progress]}
              icon={<CircleDashed size={18} color={colors.primary} weight="regular" />}
              active={statusFilter === SourceDTOStatus.in_progress}
              onPress={() => setStatusFilter(statusFilter === SourceDTOStatus.in_progress ? "all" : SourceDTOStatus.in_progress)}
            />
            <StatTile
              label="Reflecting"
              count={statusCounts[SourceDTOStatus.reflecting]}
              icon={<Sparkle size={18} color={colors.reflectAccent} weight="regular" />}
              active={statusFilter === SourceDTOStatus.reflecting}
              onPress={() => setStatusFilter(statusFilter === SourceDTOStatus.reflecting ? "all" : SourceDTOStatus.reflecting)}
            />
            <StatTile
              label="Done"
              count={statusCounts[SourceDTOStatus.done]}
              icon={<CheckCircle size={18} color={colors.dot.done} weight="regular" />}
              active={statusFilter === SourceDTOStatus.done}
              onPress={() => setStatusFilter(statusFilter === SourceDTOStatus.done ? "all" : SourceDTOStatus.done)}
            />
          </ScrollView>

          {showFlatList ? (
            <View style={styles.sectionBlock}>
              <View style={styles.sectionHeader}>
                <View style={styles.filterHeaderLeft}>
                  <Text style={styles.sectionTitle}>
                    {statusFilter === "all"
                      ? "Search results"
                      : STATUS_SECTIONS.find((s) => s.key === statusFilter)?.label ?? "Sources"}
                  </Text>
                  <Text style={styles.filterHeaderCount}>{flatFiltered.length}</Text>
                </View>
                <TouchableOpacity
                  style={styles.clearFilterBtn}
                  onPress={() => {
                    setStatusFilter("all");
                    setSearchQuery("");
                    setSearchVisible(false);
                  }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <X size={11} color={colors.muted} weight="bold" />
                  <Text style={styles.clearFilterText}>Clear</Text>
                </TouchableOpacity>
              </View>
              {flatFiltered.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyText}>
                    {searchActive ? "No sources match your search." : "No sources in this status."}
                  </Text>
                </View>
              ) : (
                <View style={styles.sectionCard}>
                  {flatFiltered.map((item, idx) => (
                    <SourceRow
                      key={item.id}
                      source={item}
                      isDownloaded={downloadedIds.has(item.id)}
                      isLast={idx === flatFiltered.length - 1}
                      accent={STATUS_SECTIONS.find((s) => s.key === item.status)?.accent ?? colors.primary}
                      hideStatusIndicator={statusFilter !== "all"}
                      onPress={() => router.push(`/sources/${item.id}`)}
                      onShowActions={() => onShowActions(item)}
                    />
                  ))}
                </View>
              )}
            </View>
          ) : (
            <>
              {STATUS_SECTIONS.map((section) => {
                const items = sectionedSources[section.key];
                if (!items || items.length === 0) return null;
                const preview = items.slice(0, SECTION_PREVIEW_COUNT);
                return (
                  <View key={section.key} style={styles.sectionBlock}>
                    <View style={styles.sectionHeader}>
                      <Text style={styles.sectionTitle}>{section.label}</Text>
                      {items.length > SECTION_PREVIEW_COUNT && (
                        <TouchableOpacity
                          style={styles.seeAllBtn}
                          onPress={() => setStatusFilter(section.key)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Text style={styles.seeAllText}>See all</Text>
                          <CaretRight size={12} color={colors.muted} weight="bold" />
                        </TouchableOpacity>
                      )}
                    </View>
                    <View style={styles.sectionCard}>
                      {preview.map((item, idx) => (
                        <SourceRow
                          key={item.id}
                          source={item}
                          isDownloaded={downloadedIds.has(item.id)}
                          isLast={idx === preview.length - 1}
                          accent={section.accent}
                          onPress={() => router.push(`/sources/${item.id}`)}
                          onShowActions={() => onShowActions(item)}
                        />
                      ))}
                    </View>
                  </View>
                );
              })}

              {baseFiltered.length === 0 && (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyText}>
                    {hasActiveFilters ? "No sources match your filters." : "No sources yet."}
                  </Text>
                </View>
              )}
            </>
          )}
        </ScrollView>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 20,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: colors.foreground,
    paddingVertical: 0,
  },

  filterScroll: { flexGrow: 0, flexShrink: 0 },
  filterRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 20,
    paddingBottom: 12,
  },

  scrollContent: { paddingBottom: 120 },

  overviewLabel: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.foreground,
    paddingHorizontal: 20,
    marginTop: 4,
    marginBottom: 10,
  },
  tilesRow: {
    paddingHorizontal: 20,
    gap: 8,
    paddingBottom: 4,
  },

  sectionBlock: {
    marginTop: 20,
    paddingHorizontal: 20,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.foreground,
  },
  seeAllBtn: { flexDirection: "row", alignItems: "center", gap: 2 },
  seeAllText: { fontSize: 12, color: colors.muted, fontWeight: "500" },

  filterHeaderLeft: { flexDirection: "row", alignItems: "baseline", gap: 8 },
  filterHeaderCount: {
    fontSize: 12,
    color: colors.muted,
    fontWeight: "500",
  },
  clearFilterBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: colors.borderSoft,
  },
  clearFilterText: { fontSize: 11, color: colors.muted, fontWeight: "500" },

  sectionCard: {
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },

  emptyState: { alignItems: "center", paddingTop: 60, paddingHorizontal: 20 },
  emptyText: { fontSize: 14, color: colors.muted, textAlign: "center" },
});
