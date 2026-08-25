import { useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { DotsThreeVertical } from "phosphor-react-native/src/icons/DotsThreeVertical";
import { useRefreshControl } from "@/lib/use-refresh-control";
import { usePlaySource } from "@/features/player/use-play-source";
import { usePlayer } from "@/features/player/context";
import { HighlightModal } from "@/features/sources/components/transcript";
import type { CitationWithCapture } from "@/features/sources/hooks";
import { useSourceHubData } from "@/features/sources/hooks/use-source-hub-data";
import { useSourceDownload } from "@/features/sources/hooks/use-source-download";
import { useSourceTranscript } from "@/features/sources/hooks/use-source-transcript";
import { SourceHeader } from "@/features/sources/components/hub/source-header";
import { HubTabBar, type HubTab } from "@/features/sources/components/hub/hub-tab-bar";
import { OverviewTab } from "@/features/sources/components/hub/overview-tab";
import { HighlightsTab } from "@/features/sources/components/hub/highlights-tab";
import { TranscriptTab } from "@/features/sources/components/hub/transcript-tab";
import { NotesTab } from "@/features/sources/components/hub/notes-tab";
import { colors } from "@/features/sources/components/hub/theme";

export default function SourceHubScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const sourceId = id && Number.isFinite(Number(id)) ? Number(id) : null;

  const [activeTab, setActiveTab] = useState<HubTab>("overview");
  const [highlightModal, setHighlightModal] = useState<CitationWithCapture | null>(null);

  const playSource = usePlaySource();
  const { track: activeTrack, isPlaying, pause } = usePlayer();
  const {
    source,
    isLoading,
    citations,
    captures,
    takeaways,
    sourceNotes,
    refreshKeys,
    recentActivity,
    highlightGroups,
    totalHighlights,
    reviewableSuggestionCount,
  } = useSourceHubData(sourceId);

  const refreshControl = useRefreshControl(refreshKeys);
  const { status: downloadStatus, download } = useSourceDownload(source);
  const transcriptState = useSourceTranscript(source, citations, captures);

  const isAV = source?.episode_id != null;
  const tabs: { key: HubTab; label: string; count?: number }[] = [
    { key: "overview", label: "Overview" },
    { key: "highlights", label: "Highlights", count: totalHighlights },
    ...(isAV ? [{ key: "transcript" as HubTab, label: "Transcript" }] : []),
    { key: "notes", label: "Notes" },
  ];

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.container, { paddingTop: insets.top + 16 }]}
      refreshControl={refreshControl}
    >
      <View style={styles.navRow}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>‹ Back</Text>
        </TouchableOpacity>
        <TouchableOpacity hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <DotsThreeVertical size={22} color={colors.muted} weight="bold" />
        </TouchableOpacity>
      </View>

      {isLoading && <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />}

      {source && (
        <>
          <SourceHeader
            source={source}
            downloadStatus={downloadStatus}
            isActiveTrack={activeTrack?.source.id === source.id}
            isPlaying={isPlaying}
            onPlay={() => { void playSource(source); }}
            onPause={() => { void pause(); }}
            onDownload={download}
          />

          <HubTabBar tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

          {activeTab === "overview" && (
            <OverviewTab
              source={source}
              recentActivity={recentActivity}
              takeaways={takeaways}
              totalHighlights={totalHighlights}
              reviewableSuggestionCount={reviewableSuggestionCount}
              onViewAllHighlights={() => setActiveTab("highlights")}
            />
          )}

          {activeTab === "highlights" && (
            <HighlightsTab groups={highlightGroups} totalHighlights={totalHighlights} />
          )}

          {activeTab === "transcript" && isAV && (
            <TranscriptTab
              transcript={transcriptState.transcript}
              transcriptLoading={transcriptState.transcriptLoading}
              transcriptProcessing={transcriptState.transcriptProcessing}
              citationsByUtteranceIdx={transcriptState.citationsByUtteranceIdx}
              triggering={transcriptState.triggering}
              onTriggerGeneration={transcriptState.triggerGeneration}
              onHighlightPress={setHighlightModal}
            />
          )}

          {activeTab === "notes" && <NotesTab notes={sourceNotes} />}
        </>
      )}

      <HighlightModal highlight={highlightModal} onClose={() => setHighlightModal(null)} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  container: { paddingBottom: 120 },
  navRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 24, marginBottom: 16 },
  backButton: {},
  backText: { fontSize: 16, color: colors.primary, fontWeight: "600" },
});
