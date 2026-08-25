import { useAddToLibrary, usePodcastEpisodes, usePodcastShow } from "@/features/podcasts/hooks";
import { usePlayer, readLocalTranscript } from "@/features/player/context";
import {
  PLAYBACK_COMPLETE_PROGRESS,
  formatTimestamp,
  getSourcePlaybackPosition,
  isReflectingOrDone,
} from "@/lib/utils";
import { useOfflineStore } from "@/features/offline";
import { useSources } from "@/features/sources/hooks";
import { appTheme } from "@/features/ui";

type DownloadStatus = "idle" | "checking" | "downloading" | "done" | "error";
import type { PodcastEpisodeDTO, ShowDTO } from "@/features/podcasts/types";
import type { SourceDTO } from "@/features/sources/api";
import { Plus } from "phosphor-react-native/src/icons/Plus";
import { Check } from "phosphor-react-native/src/icons/Check";
import { BookOpen } from "phosphor-react-native/src/icons/BookOpen";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const colors = {
  ...appTheme.color,
  progressBg: "#D6EAE0",
};

function formatDuration(seconds?: number) {
  if (!seconds) return null;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function formatDate(dateStr?: string) {
  if (!dateStr) return null;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatTimeLeft(posSec: number, durSec?: number) {
  if (!durSec || durSec === 0) return formatTimestamp(posSec);
  const left = Math.max(0, durSec - posSec);
  const m = Math.floor(left / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m left`;
  return `${m}m left`;
}

function useSourceDownloadStatus(sourceId: number | null) {
  const offline = useOfflineStore();
  const [status, setStatus] = useState<DownloadStatus>("checking");
  useEffect(() => {
    if (sourceId == null) {
      setStatus("idle");
      return;
    }
    setStatus(offline.isSourceDownloaded(sourceId) ? "done" : "idle");
  }, [sourceId, offline, offline.version]);
  return { status, setStatus };
}

type Tab = "episodes" | "about";

export default function PodcastEpisodesScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data: show } = usePodcastShow(slug ?? null);
  const { data, isLoading, error } = usePodcastEpisodes(slug ?? null);
  const { data: sources = [] } = useSources();
  const episodes = data?.data ?? [];
  const [activeTab, setActiveTab] = useState<Tab>("episodes");

  const sourceByEpisodeId = useMemo(() => {
    const map = new Map<number, SourceDTO>();
    for (const s of sources) {
      if (s.episode_id != null) map.set(s.episode_id, s);
    }
    return map;
  }, [sources]);

  const inLibraryCount = useMemo(
    () => episodes.filter((e) => sourceByEpisodeId.has(e.id)).length,
    [episodes, sourceByEpisodeId]
  );

  const resumeEpisode = useMemo(() => {
    return episodes.find((e) => {
      const src = sourceByEpisodeId.get(e.id);
      if (!src || isReflectingOrDone(src)) return false;
      const { posSec, durSec } = getSourcePlaybackPosition(src.metadata);
      return posSec > 0 && (!durSec || posSec / durSec < PLAYBACK_COMPLETE_PROGRESS);
    }) ?? null;
  }, [episodes, sourceByEpisodeId]);

  const categories = show?.categories?.slice(0, 3).join(" | ");

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>‹ Back</Text>
        </TouchableOpacity>
        <View style={styles.showRow}>
          {show?.image_url ? (
            <Image source={{ uri: show.image_url }} style={styles.showThumb} resizeMode="cover" />
          ) : (
            <View style={[styles.showThumb, styles.showThumbPlaceholder]}>
              <Text style={styles.showThumbText}>{(show?.title ?? slug ?? "?").slice(0, 1).toUpperCase()}</Text>
            </View>
          )}
          <View style={styles.showMeta}>
            <Text style={styles.showTitle} numberOfLines={2}>{show?.title ?? slug}</Text>
            {categories ? (
              <Text style={styles.showCategories} numberOfLines={1}>{categories}</Text>
            ) : show?.author ? (
              <Text style={styles.showCategories} numberOfLines={1}>{show.author}</Text>
            ) : null}
          </View>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <StatCard value={String(data?.pagination?.total ?? "—")} label="Episodes" />
          <StatCard value={String(inLibraryCount)} label="In Library" />
        </View>
      </View>

      {/* Tab bar */}
      <View style={styles.tabBar}>
        {(["episodes", "about"] as Tab[]).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {activeTab === "about" ? (
        <ScrollView contentContainerStyle={styles.aboutContainer}>
          {show?.description ? (
            <Text style={styles.aboutText}>{show.description}</Text>
          ) : (
            <Text style={styles.emptyText}>No description available.</Text>
          )}
        </ScrollView>
      ) : (
        <>
          {isLoading && <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />}
          {error && <Text style={styles.error}>{error.message}</Text>}
          <FlatList
            data={episodes.filter((e) => e.id !== resumeEpisode?.id)}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={styles.list}
            ListHeaderComponent={
              resumeEpisode ? (
                <View>
                  <Text style={styles.sectionLabel}>Continue listening</Text>
                  <ResumeCard
                    episode={resumeEpisode}
                    source={sourceByEpisodeId.get(resumeEpisode.id)!}
                  />
                  <Text style={styles.sectionLabel}>All episodes</Text>
                </View>
              ) : null
            }
            renderItem={({ item }) => (
              <EpisodeCard
                episode={item}
                source={sourceByEpisodeId.get(item.id) ?? null}
                show={show}
              />
            )}
            ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          />
        </>
      )}
    </View>
  );
}

function StatCard({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function ResumeCard({ episode, source }: { episode: PodcastEpisodeDTO; source: SourceDTO }) {
  const { play } = usePlayer();
  const router = useRouter();
  const { posSec, durSec, progress } = getSourcePlaybackPosition(source.metadata);

  const handlePlay = useCallback(() => {
    const transcript = readLocalTranscript(source.id);
    router.navigate("/player");
    void play({ episode, source, transcript }, posSec > 0 ? posSec : undefined);
  }, [episode, source, play, router, posSec]);

  const date = formatDate(episode.published_at ?? undefined);
  const duration = formatDuration(episode.duration ?? durSec);
  const timeLeft = formatTimeLeft(posSec, episode.duration ?? durSec);

  return (
    <View style={styles.resumeCard}>
      <View style={styles.resumeRow}>
        {episode.image_url ? (
          <Image source={{ uri: episode.image_url }} style={styles.resumeThumb} resizeMode="cover" />
        ) : (
          <View style={[styles.resumeThumb, styles.episodeThumbPlaceholder]}>
            <Text style={styles.thumbPlaceholderText}>{episode.title.slice(0, 1).toUpperCase()}</Text>
          </View>
        )}
        <View style={styles.resumeContent}>
          <Text style={styles.resumeTitle} numberOfLines={2}>{episode.title}</Text>
          {/* Progress bar */}
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${Math.min(progress ?? 0, 1) * 100}%` }]} />
          </View>
          <Text style={styles.resumeTimeLeft}>{timeLeft}</Text>
          <Text style={styles.resumeMeta}>{[date, duration].filter(Boolean).join(" · ")}</Text>
        </View>
      </View>
      <TouchableOpacity style={styles.resumeBtn} onPress={handlePlay} activeOpacity={0.85}>
        <Text style={styles.resumeBtnText}>▶  Resume</Text>
      </TouchableOpacity>
    </View>
  );
}

function EpisodeCard({ episode, source, show }: { episode: PodcastEpisodeDTO; source: SourceDTO | null; show?: ShowDTO }) {
  const { status, setStatus } = useSourceDownloadStatus(source?.id ?? null);
  const { mutateAsync: addToLibraryAsync, isPending: isAdding } = useAddToLibrary();
  const { play } = usePlayer();
  const router = useRouter();
  const offline = useOfflineStore();
  const inLibrary = source != null;

  const handleAddToLibrary = useCallback(() => {
    addToLibraryAsync({ episode_id: episode.id })
      .then(() => Alert.alert("Added", `"${episode.title}" added to your library.`))
      .catch(() => Alert.alert("Error", "Could not add episode to library."));
  }, [episode, addToLibraryAsync]);

  const handleDownload = useCallback(async () => {
    setStatus("downloading");
    try {
      const downloadSource: SourceDTO = inLibrary
        ? source!
        : await addToLibraryAsync({ episode_id: episode.id });
      await offline.downloadSource({
        source: downloadSource,
        episode,
        podcast: show,
      });
      setStatus("done");
    } catch {
      setStatus("error");
    }
  }, [episode, inLibrary, source, addToLibraryAsync, offline, setStatus]);

  const handlePlay = useCallback(() => {
    if (!source) return;
    const transcript = readLocalTranscript(source.id);
    const { posSec } = getSourcePlaybackPosition(source.metadata);
    // Open the player immediately; audio buffers in the background.
    router.navigate("/player");
    void play({ episode, source, transcript }, posSec > 0 ? posSec : undefined);
  }, [episode, source, play, router]);

  const date = formatDate(episode.published_at ?? undefined);
  const duration = formatDuration(episode.duration ?? undefined);

  return (
    <TouchableOpacity
      style={styles.episodeCard}
      onPress={inLibrary ? handlePlay : undefined}
      activeOpacity={inLibrary ? 0.7 : 1}
    >
      <View style={styles.episodeTop}>
        {episode.image_url ? (
          <Image source={{ uri: episode.image_url }} style={styles.episodeThumb} resizeMode="cover" />
        ) : (
          <View style={[styles.episodeThumb, styles.episodeThumbPlaceholder]}>
            <Text style={styles.thumbPlaceholderText}>{episode.title.slice(0, 1).toUpperCase()}</Text>
          </View>
        )}
        <View style={styles.episodeContent}>
          <Text style={styles.episodeTitle} numberOfLines={3}>{episode.title}</Text>
          <Text style={styles.episodeMeta}>{[date, duration].filter(Boolean).join(" · ")}</Text>
        </View>
        {/* actions */}
        <View style={styles.cardActions}>
          {inLibrary && (
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => router.push(`/sources/${source!.id}`)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <BookOpen size={16} color={colors.primary} weight="regular" />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={inLibrary ? (status === "done" ? undefined : handleDownload) : handleAddToLibrary}
            disabled={isAdding || status === "downloading"}
            activeOpacity={0.8}
          >
            {isAdding || status === "downloading" ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : inLibrary && status === "done" ? (
              <Check size={16} color={colors.primary} weight="bold" />
            ) : (
              <Plus size={16} color={colors.muted} weight="regular" />
            )}
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },

  header: { paddingHorizontal: 16, paddingBottom: 12 },
  backButton: { marginBottom: 10 },
  backText: { fontSize: 16, color: colors.primary, fontWeight: "500" },

  showRow: { flexDirection: "row", gap: 14, alignItems: "center", marginBottom: 14 },
  showThumb: { width: 80, height: 80, borderRadius: 14 },
  showThumbPlaceholder: { backgroundColor: colors.borderSoft, alignItems: "center", justifyContent: "center" },
  showThumbText: { fontSize: 30, fontWeight: "700", color: colors.muted },
  showMeta: { flex: 1, gap: 4 },
  showTitle: { fontSize: 18, fontWeight: "700", color: colors.foreground, lineHeight: 24 },
  showCategories: { fontSize: 13, color: colors.muted },

  statsRow: { flexDirection: "row", gap: 10 },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  statValue: { fontSize: 18, fontWeight: "700", color: colors.foreground },
  statLabel: { fontSize: 11, color: colors.muted, marginTop: 1 },

  tabBar: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: colors.border, paddingHorizontal: 16 },
  tab: { paddingVertical: 10, paddingHorizontal: 14, borderBottomWidth: 2, borderBottomColor: "transparent", marginBottom: -1 },
  tabActive: { borderBottomColor: colors.primary },
  tabText: { fontSize: 14, fontWeight: "500", color: colors.muted },
  tabTextActive: { color: colors.primary, fontWeight: "600" },

  list: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 80 },

  sectionLabel: { fontSize: 15, fontWeight: "700", color: colors.foreground, marginBottom: 10, marginTop: 4 },

  // Resume card
  resumeCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 12,
    marginBottom: 20,
  },
  resumeRow: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  resumeThumb: { width: 64, height: 64, borderRadius: 10 },
  resumeContent: { flex: 1, gap: 6 },
  resumeTitle: { fontSize: 14, fontWeight: "600", color: colors.foreground, lineHeight: 19 },
  progressTrack: { height: 4, backgroundColor: colors.progressBg, borderRadius: 2 },
  progressFill: { height: 4, backgroundColor: colors.primary, borderRadius: 2 },
  resumeTimeLeft: { fontSize: 11, color: colors.muted },
  resumeMeta: { fontSize: 11, color: colors.muted },
  resumeBtn: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  resumeBtnText: { color: colors.primaryForeground, fontSize: 14, fontWeight: "700" },

  // Episode cards
  episodeCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
  },
  episodeTop: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  episodeThumb: { width: 64, height: 64, borderRadius: 10, flexShrink: 0 },
  episodeThumbPlaceholder: { backgroundColor: colors.borderSoft, alignItems: "center", justifyContent: "center" },
  thumbPlaceholderText: { fontSize: 22, fontWeight: "600", color: colors.muted },
  episodeContent: { flex: 1, gap: 4 },
  episodeTitle: { fontSize: 14, fontWeight: "500", color: colors.foreground, lineHeight: 19 },
  episodeMeta: { fontSize: 12, color: colors.muted },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 2 },
  tag: { backgroundColor: colors.borderSoft, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  tagText: { fontSize: 11, color: colors.primary, fontWeight: "500" },

  cardActions: { flexDirection: "column", gap: 6, alignItems: "center" },
  actionBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: colors.borderSoft,
    borderWidth: 1, borderColor: colors.border,
    alignItems: "center", justifyContent: "center",
    flexShrink: 0,
  },

  aboutContainer: { padding: 20 },
  aboutText: { fontSize: 14, color: colors.muted, lineHeight: 21 },
  emptyText: { fontSize: 14, color: colors.muted, textAlign: "center", paddingTop: 40 },
  error: { color: "red", margin: 24 },
});
