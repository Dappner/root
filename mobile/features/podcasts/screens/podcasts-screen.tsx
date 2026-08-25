import {
  usePodcastShows,
  useContinueListening,
  useMyPodcastEpisodes,
} from "@/features/podcasts/hooks";
import type { ShowDTO } from "@/features/podcasts/types";
import type { SourceDTO } from "@/features/sources/api";
import { useUpdateSourceStatus } from "@/features/sources/hooks";
import { useOfflineStore } from "@/features/offline";
import { usePlaySource } from "@/features/player/use-play-source";
import { Shelf } from "@/features/podcasts/components/shelf";
import { ResumeCard } from "@/features/podcasts/components/resume-card";
import { ShowCard } from "@/features/podcasts/components/show-card";
import { SourceRow } from "@/features/sources/components/source-row";
import { SourceActionsSheet } from "@/features/sources/components/source-actions-sheet";
import { STATUS_SECTIONS } from "@/features/library/theme";
import { appTheme } from "@/features/ui";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";

const colors = appTheme.color;

function statusAccent(status?: string): string {
  return STATUS_SECTIONS.find((s) => s.key === status)?.accent ?? colors.primary;
}

export default function PodcastsScreen() {
  const { data, isLoading, error } = usePodcastShows();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const offline = useOfflineStore();
  const playSource = usePlaySource();
  const updateStatus = useUpdateSourceStatus();

  const shows = data?.data ?? [];
  const continueListening = useContinueListening(10);
  const myEpisodes = useMyPodcastEpisodes();
  const [actionSheetSource, setActionSheetSource] = useState<SourceDTO | null>(null);

  const downloadedPodcasts = useMemo(
    () => offline.listDownloadedPodcastMetas(),
    [offline, offline.version]
  );
  const downloadedSources = useMemo(
    () => offline.listDownloadedSources(),
    [offline, offline.version]
  );
  const downloadedIds = useMemo(
    () => new Set(downloadedSources.map((m) => m.source.id)),
    [downloadedSources]
  );
  const episodeCountByPodcast = useMemo(() => {
    const m = new Map<number, number>();
    for (const meta of downloadedSources) {
      if (meta.podcast_id == null) continue;
      m.set(meta.podcast_id, (m.get(meta.podcast_id) ?? 0) + 1);
    }
    return m;
  }, [downloadedSources]);

  const openShow = (slug: string) => router.push(`/(app)/(tabs)/(podcasts)/${slug}`);

  const isEmpty =
    continueListening.length === 0 && shows.length === 0 && myEpisodes.length === 0;

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Podcasts</Text>
        <Text style={styles.subtitle}>Pick up where you left off</Text>
      </View>

      {isLoading && <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />}
      {error && <Text style={styles.error}>{error.message}</Text>}

      {!isLoading && (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
        >
          {continueListening.length > 0 && (
            <Shelf title="Continue">
              {continueListening.map((item) => (
                <ResumeCard
                  key={item.source.id}
                  item={item}
                  onPress={() => router.push(`/sources/${item.source.id}`)}
                  onPlay={() => playSource(item.source)}
                />
              ))}
            </Shelf>
          )}

          {downloadedPodcasts.length > 0 && (
            <Shelf title="Downloaded">
              {downloadedPodcasts.map((meta) => {
                const count = episodeCountByPodcast.get(meta.podcast_id) ?? 0;
                return (
                  <ShowCard
                    key={meta.podcast_id}
                    title={meta.title}
                    imageUrl={meta.image_url}
                    subtitle={`${count} episode${count === 1 ? "" : "s"}`}
                    onPress={() => openShow(meta.slug)}
                  />
                );
              })}
            </Shelf>
          )}

          {shows.length > 0 && (
            <Shelf title="Your shows">
              {shows.map((show) => (
                <ShowCard
                  key={show.id}
                  title={show.title}
                  imageUrl={show.image_url}
                  subtitle={showSubtitle(show)}
                  onPress={() => openShow(show.slug)}
                />
              ))}
            </Shelf>
          )}

          {myEpisodes.length > 0 && (
            <View style={styles.episodesBlock}>
              <Text style={styles.episodesLabel}>All episodes</Text>
              <View style={styles.episodesCard}>
                {myEpisodes.map((source, idx) => (
                  <SourceRow
                    key={source.id}
                    source={source}
                    isDownloaded={downloadedIds.has(source.id)}
                    isLast={idx === myEpisodes.length - 1}
                    accent={statusAccent(source.status)}
                    onPress={() => router.push(`/sources/${source.id}`)}
                    onShowActions={() => setActionSheetSource(source)}
                  />
                ))}
              </View>
            </View>
          )}

          {isEmpty && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No podcasts yet.</Text>
            </View>
          )}
        </ScrollView>
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

function showSubtitle(show: ShowDTO): string | null {
  const categories = show.categories?.slice(0, 2).join(" · ");
  return categories || show.author || null;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 20,
  },
  title: { fontSize: 28, fontWeight: "700", color: colors.foreground, letterSpacing: -0.5 },
  subtitle: { fontSize: 14, color: colors.muted, marginTop: 2 },
  content: { paddingTop: 4, paddingBottom: 120 },

  episodesBlock: { paddingHorizontal: 20, marginBottom: 8 },
  episodesLabel: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.foreground,
    letterSpacing: -0.4,
    marginBottom: 12,
  },
  episodesCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },

  emptyState: { alignItems: "center", paddingTop: 80, paddingHorizontal: 20 },
  emptyText: { fontSize: 14, color: colors.muted, textAlign: "center" },
  error: { color: colors.danger, margin: 24 },
});
