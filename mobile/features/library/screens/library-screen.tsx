import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSources, useUpdateSourceStatus } from "@/features/sources/hooks";
import { useNotes } from "@/features/notes/hooks";
import { useCollections } from "@/features/collections/hooks";
import { usePlaySource } from "@/features/player/use-play-source";
import type { SourceDTO } from "@/features/sources/api";
import { SourceActionsSheet } from "@/features/sources/components/source-actions-sheet";
import { LibraryHeader } from "@/features/library/components/library-header";
import { TabSwitcher, type LibTab } from "@/features/library/components/tab-switcher";
import { SourcesTab } from "@/features/library/components/sources-tab";
import { NotesTab } from "@/features/library/components/notes-tab";
import { TakeawaysTab } from "@/features/library/components/takeaways-tab";
import { CollectionsTab } from "@/features/library/components/collections-tab";
import { useLibraryFilters } from "@/features/library/hooks/use-library-filters";
import { colors } from "@/features/library/theme";

const VALID_TABS: LibTab[] = ["sources", "notes", "takeaways", "collections"];

export default function LibraryScreen() {
  const { data: sources, isLoading: sourcesLoading } = useSources();
  const { data: notesData, isLoading: notesLoading } = useNotes();
  const { data: collectionsData, isLoading: collectionsLoading } = useCollections();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const playSource = usePlaySource();
  const updateStatus = useUpdateSourceStatus();

  const { tab: tabParam } = useLocalSearchParams<{ tab?: string }>();
  const initialTab: LibTab = VALID_TABS.includes(tabParam as LibTab) ? (tabParam as LibTab) : "sources";
  const [activeTab, setActiveTab] = useState<LibTab>(initialTab);
  // Respond to subsequent navigations that pass a different ?tab= param.
  useEffect(() => {
    if (tabParam && VALID_TABS.includes(tabParam as LibTab)) {
      setActiveTab(tabParam as LibTab);
    }
  }, [tabParam]);
  const [actionSheetSource, setActionSheetSource] = useState<SourceDTO | null>(null);

  const filters = useLibraryFilters({ sources });

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <LibraryHeader
        showSearchButton={activeTab === "sources"}
        searchVisible={filters.searchVisible}
        onToggleSearch={() => {
          filters.setSearchVisible((v) => !v);
          if (filters.searchVisible) filters.setSearchQuery("");
        }}
      />

      <TabSwitcher activeTab={activeTab} onChange={setActiveTab} />

      {activeTab === "sources" && (
        <SourcesTab
          loading={sourcesLoading}
          filters={filters}
          onShowActions={setActionSheetSource}
        />
      )}
      {activeTab === "notes" && (
        <NotesTab loading={notesLoading} notes={notesData ?? []} />
      )}
      {activeTab === "takeaways" && <TakeawaysTab />}
      {activeTab === "collections" && (
        <CollectionsTab loading={collectionsLoading} collections={collectionsData ?? []} />
      )}

      <SourceActionsSheet
        source={actionSheetSource}
        onClose={() => setActionSheetSource(null)}
        onPlay={(s) => { setActionSheetSource(null); playSource(s); }}
        onOpen={(s) => { setActionSheetSource(null); router.push(`/sources/${s.id}`); }}
        onStatusChange={(id, status) => {
          updateStatus.mutate({ id, status });
          setActionSheetSource(null);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
});
