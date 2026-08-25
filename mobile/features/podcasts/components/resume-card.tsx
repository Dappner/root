import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Play } from "phosphor-react-native/src/icons/Play";
import { appTheme } from "@/features/ui";
import { formatTimestamp } from "@/lib/utils";
import type { ContinueListeningItem } from "@/features/podcasts/hooks";

const colors = appTheme.color;

export const RESUME_CARD_WIDTH = 240;

function formatResumeAgo(iso: string | null): string {
  if (!iso) return "Resume";
  const diffDays = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (diffDays <= 0) return "Resume · Today";
  if (diffDays === 1) return "Resume · Yesterday";
  if (diffDays < 7) return `Resume · ${diffDays}d ago`;
  if (diffDays < 30) return `Resume · ${Math.floor(diffDays / 7)}w ago`;
  return `Resume · ${Math.floor(diffDays / 30)}mo ago`;
}

export interface ResumeCardProps {
  item: ContinueListeningItem;
  onPress: () => void;
  onPlay: () => void;
}

/**
 * Apple-Podcasts-style "Up Next" card: artwork-forward, with the resume label,
 * episode title, an inline play pill and a progress bar.
 */
export function ResumeCard({ item, onPress, onPlay }: ResumeCardProps) {
  const { source, playback } = item;
  const { posSec, durSec, progress, lastListenedAt } = playback;
  const timeLeft =
    durSec > 0 ? `${formatTimestamp(Math.max(0, durSec - posSec))} left` : null;

  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.85} onPress={onPress}>
      {source.image_url ? (
        <Image source={{ uri: source.image_url }} style={styles.art} resizeMode="cover" />
      ) : (
        <View style={[styles.art, styles.artPlaceholder]}>
          <Text style={styles.artPlaceholderText}>{source.title.slice(0, 1).toUpperCase()}</Text>
        </View>
      )}
      <Text style={styles.resumeLabel}>{formatResumeAgo(lastListenedAt)}</Text>
      <Text style={styles.title} numberOfLines={2}>{source.title}</Text>
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.playPill}
          onPress={(e) => { e.stopPropagation(); onPlay(); }}
          activeOpacity={0.85}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Play size={13} color={colors.primaryForeground} weight="fill" />
          {timeLeft && <Text style={styles.playPillText}>{timeLeft}</Text>}
        </TouchableOpacity>
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${Math.min(progress ?? 0, 1) * 100}%` }]} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    width: RESUME_CARD_WIDTH,
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    gap: 6,
  },
  art: { width: "100%", height: 132, borderRadius: 10 },
  artPlaceholder: { backgroundColor: colors.borderSoft, alignItems: "center", justifyContent: "center" },
  artPlaceholderText: { fontSize: 40, fontWeight: "700", color: colors.muted },
  resumeLabel: { fontSize: 11, fontWeight: "600", color: colors.primary },
  title: { fontSize: 14, fontWeight: "600", color: colors.foreground, lineHeight: 18, minHeight: 36 },
  footer: { flexDirection: "row", alignItems: "center" },
  playPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.primary,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  playPillText: { fontSize: 12, fontWeight: "600", color: colors.primaryForeground },
  progressTrack: { height: 3, backgroundColor: colors.borderSoft, borderRadius: 2, marginTop: 2 },
  progressFill: { height: 3, backgroundColor: colors.primary, borderRadius: 2 },
});
