import type { SourceDTO } from "../api";
import { SourceDTOStatus } from "@/lib/api/rag-generated";
import { PLAYBACK_COMPLETE_PROGRESS, getSourcePlaybackPosition } from "@/lib/utils";
import { formatDuration, formatRemaining, formatSourceMeta } from "../lib/format";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Check } from "phosphor-react-native/src/icons/Check";
import { DotsThree } from "phosphor-react-native/src/icons/DotsThree";
import { DownloadSimple } from "phosphor-react-native/src/icons/DownloadSimple";
import { Sparkle } from "phosphor-react-native/src/icons/Sparkle";

const colors = {
  foreground: "#2C2C2C",
  muted: "#666050",
  borderSoft: "#E4DBC5",
  secondary: "#E4DBC5",
  primary: "#3F6B51",
  reflectAccent: "#7B5BB6",
  background: "#FAF5EB",
};

export interface SourceRowProps {
  source: SourceDTO;
  isDownloaded: boolean;
  isLast: boolean;
  accent: string;
  hideStatusIndicator?: boolean;
  onPress: () => void;
  onShowActions: () => void;
}

export function SourceRow({
  source,
  isDownloaded,
  isLast,
  accent,
  hideStatusIndicator,
  onPress,
  onShowActions,
}: SourceRowProps) {
  const { posSec, durSec, progress } = getSourcePlaybackPosition(source.metadata);
  const isDone = source.status === SourceDTOStatus.done;
  const isTodo = source.status === SourceDTOStatus.todo;
  const isReflecting = source.status === SourceDTOStatus.reflecting;
  const isPodcast = source.type === "podcast";

  const rightLabel = (() => {
    if (isTodo) return formatDuration(source.duration);
    if (durSec > 0 && posSec > 0) {
      const rem = formatRemaining(durSec, posSec);
      if (rem) return rem;
    }
    return formatDuration(source.duration);
  })();

  const showProgress =
    isPodcast && !isTodo && progress !== null && progress > 0 && progress < PLAYBACK_COMPLETE_PROGRESS;
  const pct = progress !== null ? Math.round(progress * 100) : 0;
  const metaLine = !showProgress ? formatSourceMeta(source) : null;

  return (
    <TouchableOpacity
      style={[styles.row, !isLast && styles.rowBorder]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <View style={styles.thumbWrap}>
        {source.image_url ? (
          <Image source={{ uri: source.image_url }} style={styles.thumb} resizeMode="cover" />
        ) : (
          <View style={[styles.thumb, styles.thumbPlaceholder]}>
            <Text style={styles.thumbPlaceholderText}>{source.type?.slice(0, 1).toUpperCase() ?? "?"}</Text>
          </View>
        )}
        {isDone && (
          <View style={[styles.thumbBadge, styles.doneBadge]}>
            <Check size={10} color="#FFFFFF" weight="bold" />
          </View>
        )}
        {isDownloaded && (
          <View style={[styles.thumbBadge, styles.downloadBadge, isDone && styles.thumbBadgeStacked]}>
            <DownloadSimple size={10} color="#FFFFFF" weight="bold" />
          </View>
        )}
      </View>

      <View style={styles.rowContent}>
        <View style={styles.rowTitleLine}>
          <Text style={styles.sourceTitle} numberOfLines={2}>{source.title}</Text>
          {isReflecting && (
            <Sparkle size={14} color={colors.reflectAccent} weight="fill" style={{ marginLeft: 6 }} />
          )}
        </View>

        {showProgress && (
          <View style={styles.progressRow}>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${pct}%`, backgroundColor: accent }]} />
            </View>
            <Text style={styles.progressPct}>{pct}%</Text>
          </View>
        )}

        {metaLine && (
          <View style={styles.metaLineRow}>
            <Text style={styles.metaLine} numberOfLines={1}>{metaLine}</Text>
          </View>
        )}
      </View>

      <View style={styles.rowRight}>
        {rightLabel && !isDone ? (
          <Text style={styles.rowRightLabel}>{rightLabel}</Text>
        ) : null}
        {isDone && !hideStatusIndicator && (
          <View style={styles.doneCheck}>
            <Check size={12} color={colors.primary} weight="bold" />
          </View>
        )}
        <TouchableOpacity
          onPress={(e) => { e.stopPropagation(); onShowActions(); }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={styles.rowMenu}
        >
          <DotsThree size={18} color={colors.muted} weight="bold" />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 12,
    gap: 12,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
  },
  thumbWrap: { width: 52, height: 52, flexShrink: 0 },
  thumb: { width: 52, height: 52, borderRadius: 8 },
  thumbPlaceholder: { backgroundColor: colors.secondary, alignItems: "center", justifyContent: "center" },
  thumbPlaceholderText: { fontSize: 18, fontWeight: "600", color: colors.muted },
  thumbBadge: {
    position: "absolute",
    bottom: -3,
    right: -3,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: colors.background,
  },
  thumbBadgeStacked: { right: 13 },
  doneBadge: { backgroundColor: colors.primary },
  downloadBadge: { backgroundColor: colors.muted },
  rowContent: { flex: 1, gap: 4, justifyContent: "center" },
  rowTitleLine: { flexDirection: "row", alignItems: "flex-start" },
  sourceTitle: { flex: 1, fontSize: 13.5, fontWeight: "500", color: colors.foreground, lineHeight: 18 },

  progressRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  progressTrack: { flex: 1, height: 3, backgroundColor: colors.borderSoft, borderRadius: 2 },
  progressFill: { height: 3, backgroundColor: colors.primary, borderRadius: 2 },
  progressPct: { fontSize: 10, color: colors.muted, fontWeight: "500", minWidth: 28, textAlign: "right" },

  metaLineRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  metaLine: { fontSize: 11, color: colors.muted, flexShrink: 1 },

  rowRight: { alignItems: "flex-end", flexDirection: "row", gap: 4, marginLeft: 4 },
  rowRightLabel: {
    fontSize: 11,
    color: colors.muted,
    fontWeight: "500",
    maxWidth: 60,
    textAlign: "right",
  },
  rowMenu: { padding: 2 },
  doneCheck: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
});
