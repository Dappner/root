import { usePlayer } from "./context";
import { useRouter } from "expo-router";
import { Play } from "phosphor-react-native/src/icons/Play";
import { Pause } from "phosphor-react-native/src/icons/Pause";
import { X } from "phosphor-react-native/src/icons/X";
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const colors = {
  background: "#FCFCF5",
  foreground: "#2C2C2C",
  muted: "#666050",
  border: "#C9C0A8",
  secondary: "#E4DBC5",
  primary: "#3F6B51",
};

function formatTime(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function MiniPlayer() {
  const { track, isPlaying, isLoading, positionSec, durationSec, rate, togglePlayPause, dismiss } = usePlayer();
  const router = useRouter();

  if (!track) return null;

  const progress = durationSec > 0 ? positionSec / durationSec : 0;
  const imageUrl = track.episode.image_url ?? track.source.image_url;
  const timeLabel = durationSec > 0
    ? `${formatTime(positionSec)} / ${formatTime(durationSec)}`
    : formatTime(positionSec);
  const rateLabel = rate !== 1 ? ` · ${rate}x` : " · 1x";

  return (
    <TouchableOpacity
      style={styles.container}
      activeOpacity={0.95}
      onPress={() => router.navigate("/player")}
    >
      {/* Progress bar at top */}
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
      </View>

      <View style={styles.content}>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.thumb} resizeMode="cover" />
        ) : (
          <View style={[styles.thumb, styles.thumbPlaceholder]}>
            <Text style={styles.thumbPlaceholderText}>♪</Text>
          </View>
        )}

        <View style={styles.info}>
          <Text style={styles.title} numberOfLines={1}>{track.episode.title}</Text>
          <Text style={styles.subtitle} numberOfLines={1}>{timeLabel}{rateLabel}</Text>
        </View>

        <TouchableOpacity
          style={styles.control}
          onPress={(e) => { e.stopPropagation(); togglePlayPause(); }}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          {isLoading ? (
            <ActivityIndicator color={colors.primary} size="small" />
          ) : isPlaying ? (
            <Pause size={24} color={colors.primary} weight="fill" />
          ) : (
            <Play size={24} color={colors.primary} weight="fill" />
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.control}
          onPress={(e) => { e.stopPropagation(); dismiss(); }}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <X size={16} color={colors.muted} weight="bold" />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 8,
  },
  progressTrack: { height: 2, backgroundColor: colors.secondary },
  progressFill: { height: 2, backgroundColor: colors.primary },
  content: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 12,
  },
  thumb: { width: 40, height: 40, borderRadius: 6 },
  thumbPlaceholder: {
    backgroundColor: colors.secondary,
    alignItems: "center",
    justifyContent: "center",
  },
  thumbPlaceholderText: { fontSize: 18, color: colors.muted },
  info: { flex: 1, gap: 2 },
  title: { fontSize: 13, fontWeight: "600", color: colors.foreground },
  subtitle: { fontSize: 11, color: colors.muted },
  control: { padding: 4 },
});
