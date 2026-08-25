import { ActivityIndicator, Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SourceDTOStatus } from "@/lib/api/rag-generated";
import type { SourceDTO } from "../../api";
import { formatTimestamp, getSourcePlaybackPosition, isReflectingOrDone } from "@/lib/utils";
import type { DownloadStatus } from "../../hooks/use-source-download";
import { colors } from "./theme";

const statusConfig: Record<string, { label: string; bg: string; text: string }> = {
  [SourceDTOStatus.todo]:        { label: "To do",       bg: "#EEE9DC", text: "#666050" },
  [SourceDTOStatus.in_progress]: { label: "In progress", bg: "#D6EAE0", text: "#2E6647" },
  [SourceDTOStatus.reflecting]:  { label: "Reflecting",  bg: "#DDE8F5", text: "#2C4E80" },
  [SourceDTOStatus.done]:        { label: "Done",        bg: "#E4DBC5", text: "#3F6B51" },
};

function formatDate(date?: string) {
  if (!date) return null;
  return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export interface SourceHeaderProps {
  source: SourceDTO;
  downloadStatus: DownloadStatus;
  isActiveTrack: boolean;
  isPlaying: boolean;
  onPlay: () => void;
  onPause: () => void;
  onDownload: () => void;
}

export function SourceHeader({ source, downloadStatus, isActiveTrack, isPlaying, onPlay, onPause, onDownload }: SourceHeaderProps) {
  const savedPositionSec = getSourcePlaybackPosition(source.metadata).posSec;
  const isLiveOnThisSource = isActiveTrack && isPlaying;
  const playButtonLabel = isLiveOnThisSource
    ? "❚❚ Pause"
    : isReflectingOrDone(source)
      ? "▶ Play again"
      : savedPositionSec > 0
        ? `▶ Resume ${formatTimestamp(savedPositionSec)}`
        : "▶ Play";
  const handlePress = isLiveOnThisSource ? onPause : onPlay;

  return (
    <View style={styles.header}>
      {source.image_url ? (
        <Image source={{ uri: source.image_url }} style={styles.headerThumb} resizeMode="cover" />
      ) : (
        <View style={[styles.headerThumb, styles.headerThumbPlaceholder]}>
          <Text style={styles.headerThumbText}>{source.type?.slice(0, 1).toUpperCase() ?? "R"}</Text>
        </View>
      )}
      <View style={styles.headerMeta}>
        <View style={styles.headerBadges}>
          {source.type && (
            <View style={styles.typeBadge}>
              <Text style={styles.typeBadgeText}>{source.type}</Text>
            </View>
          )}
          {source.status && (() => {
            const s = statusConfig[source.status];
            return s ? (
              <View style={[styles.statusBadge, { backgroundColor: s.bg }]}>
                <Text style={[styles.statusText, { color: s.text }]}>{s.label}</Text>
              </View>
            ) : null;
          })()}
        </View>
        <Text style={styles.title} numberOfLines={2}>{source.title}</Text>
        {source.author || source.published_at ? (
          <Text style={styles.meta} numberOfLines={1}>
            {[source.author, formatDate(source.published_at ?? undefined)].filter(Boolean).join(" · ")}
          </Text>
        ) : null}
        {source.episode_id != null && (
          <View style={styles.episodeActions}>
            <TouchableOpacity style={styles.playButton} onPress={handlePress} activeOpacity={0.85}>
              <Text style={styles.playButtonText}>{playButtonLabel}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.downloadButton,
                downloadStatus === "done" && styles.downloadButtonDone,
                downloadStatus === "downloading" && styles.downloadButtonDisabled,
              ]}
              onPress={downloadStatus === "done" ? undefined : onDownload}
              disabled={downloadStatus === "downloading"}
              activeOpacity={0.85}
            >
              {downloadStatus === "downloading" ? (
                <ActivityIndicator color={colors.primary} size="small" />
              ) : downloadStatus === "done" ? (
                <Text style={styles.downloadButtonDoneText}>✓</Text>
              ) : (
                <Text style={styles.downloadButtonText}>↓</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", paddingHorizontal: 24, marginBottom: 16, gap: 14, alignItems: "flex-start" },
  headerThumb: { width: 72, height: 72, borderRadius: 12, flexShrink: 0 },
  headerThumbPlaceholder: { backgroundColor: colors.secondary, alignItems: "center", justifyContent: "center" },
  headerThumbText: { fontSize: 26, fontWeight: "700", color: colors.muted },
  headerMeta: { flex: 1, gap: 5 },
  headerBadges: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  typeBadge: { alignSelf: "flex-start", backgroundColor: colors.secondary, borderRadius: 5, paddingHorizontal: 7, paddingVertical: 3 },
  typeBadgeText: { color: colors.primary, fontSize: 10, fontWeight: "700", textTransform: "capitalize" },
  statusBadge: { borderRadius: 5, paddingHorizontal: 7, paddingVertical: 3 },
  statusText: { fontSize: 10, fontWeight: "600" },
  title: { fontSize: 16, lineHeight: 22, color: colors.foreground, fontWeight: "700" },
  meta: { color: colors.muted, fontSize: 12, lineHeight: 16 },

  episodeActions: { flexDirection: "row", gap: 6, marginTop: 2 },
  playButton: { flex: 1, backgroundColor: colors.primary, borderRadius: 8, paddingVertical: 7, alignItems: "center" },
  playButtonText: { color: "#FFFFFF", fontSize: 12, fontWeight: "700" },
  downloadButton: { width: 34, backgroundColor: colors.secondary, borderRadius: 8, paddingVertical: 7, alignItems: "center", borderWidth: 1, borderColor: colors.border },
  downloadButtonDone: { opacity: 0.7 },
  downloadButtonDisabled: { opacity: 0.5 },
  downloadButtonText: { color: colors.foreground, fontSize: 14, fontWeight: "600" },
  downloadButtonDoneText: { color: colors.primary, fontSize: 14, fontWeight: "600" },
});
