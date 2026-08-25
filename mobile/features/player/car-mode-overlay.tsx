import { usePlayer } from "./context";
import { useVoiceCapture } from "./voice-capture";
import { useVoiceAgent } from "@/features/voice-agent/context";
import { Microphone } from "phosphor-react-native/src/icons/Microphone";
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
  background: "#0d1210",
  card: "#1a2e24",
  cardDark: "#1a1a1a",
  foreground: "#FFFFFF",
  muted: "#888888",
  mutedLight: "#aaaaaa",
  accent: "#4ade80",
  exitAccent: "#f87171",
};

function PauseIcon() {
  return (
    <View style={styles.pauseIcon}>
      <View style={styles.pauseBar} />
      <View style={styles.pauseBar} />
    </View>
  );
}

function PlayIcon() {
  return (
    <View style={styles.playIconWrapper}>
      <View style={styles.playIconTriangle} />
    </View>
  );
}

function WaveformIcon() {
  const bars = [28, 52, 40, 64, 44, 56, 32];
  return (
    <View style={styles.waveform}>
      {bars.map((h, i) => (
        <View key={i} style={[styles.waveBar, { height: h }]} />
      ))}
    </View>
  );
}

function formatTime(sec: number) {
  const s = Math.floor(sec);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}:${String(m % 60).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

interface Props {
  topInset?: number;
  bottomInset?: number;
}

export function CarModeOverlay({ topInset = 0, bottomInset = 0 }: Props) {
  const { track, isPlaying, isLoading, positionSec, durationSec, togglePlayPause, setCarMode } = usePlayer();
  const voiceAgent = useVoiceAgent();
  const voiceCapture = useVoiceCapture();

  if (!track) return null;

  const imageUrl = track.episode.image_url ?? track.source.image_url;
  const progress = durationSec > 0 ? positionSec / durationSec : 0;
  const remaining = Math.max(0, durationSec - positionSec);

  return (
    <View style={[styles.screen, { paddingTop: topInset + 4, paddingBottom: bottomInset + 16 }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerLabel}>CAR MODE</Text>
      </View>

      {/* Top row */}
      <View style={styles.row}>
        {/* Top-left: Play / Pause */}
        <TouchableOpacity style={[styles.tile, styles.tileGreen]} activeOpacity={0.8} onPress={togglePlayPause}>
          {imageUrl && (
            <Image source={{ uri: imageUrl }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
          )}
          <View style={styles.tileOverlay}>
            <View style={styles.tilePlayIcon}>
              {isLoading ? (
                <ActivityIndicator size="large" color={colors.foreground} />
              ) : isPlaying ? (
                <PauseIcon />
              ) : (
                <PlayIcon />
              )}
            </View>
            <Text style={styles.tileTitleLarge}>
              {isLoading ? "Loading" : isPlaying ? "Pause" : "Play"}
            </Text>
            <Text style={styles.tileAccentSmall}>
              {isLoading ? "Buffering…" : isPlaying ? "Tap to pause" : "Tap to play"}
            </Text>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
            </View>
            <Text style={styles.tileEpisodeTitle} numberOfLines={2}>{track.episode.title}</Text>
            <Text style={styles.tileShow} numberOfLines={1}>{track.source.title}</Text>
            <View style={styles.timesRow}>
              <Text style={styles.timeText}>{formatTime(positionSec)}</Text>
              <Text style={styles.timeText}>-{formatTime(remaining)}</Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* Top-right: Ask Root */}
        <TouchableOpacity
          style={[styles.tile, styles.tileGreen, voiceAgent.isActive && styles.tileActive]}
          activeOpacity={0.8}
          onPress={voiceAgent.toggle}
        >
          <Microphone
            size={72}
            color={voiceAgent.isActive ? colors.foreground : colors.accent}
            weight={voiceAgent.isActive ? "fill" : "regular"}
          />
          <View style={styles.tileCenterText}>
            <Text style={styles.tileTitle}>Ask Root</Text>
            <Text style={styles.tileAccent}>
              {voiceAgent.status === "connecting"
                ? "Connecting"
                : voiceAgent.status === "connected"
                  ? "Listening"
                  : "Voice Assistant"}
            </Text>
            <Text style={styles.tileDesc}>
              {voiceAgent.error
                ? "Tap to retry."
                : voiceAgent.isActive
                  ? "Tap to stop."
                  : "Tap to start a voice chat."}
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Bottom row */}
      <View style={styles.row}>
        {/* Bottom-left: Quick Capture (doubles as the stop control while recording) */}
        <TouchableOpacity
          style={[
            styles.tile,
            styles.tileDark,
            voiceCapture.isRecording && styles.tileActive,
            voiceCapture.isSaving && styles.tileDisabled,
          ]}
          activeOpacity={0.8}
          onPress={voiceCapture.isRecording ? voiceCapture.stop : voiceCapture.start}
          disabled={voiceCapture.isSaving}
        >
          <WaveformIcon />
          <View style={styles.tileCenterText}>
            <Text style={styles.tileTitle}>
              {voiceCapture.isRecording ? "Recording" : "Quick Capture"}
            </Text>
            <Text style={styles.tileAccent}>
              {voiceCapture.isSaving
                ? "Saving…"
                : voiceCapture.isRecording
                  ? `${formatTime(voiceCapture.elapsedSec)} / ${formatTime(voiceCapture.maxSec)}`
                  : "Save a thought"}
            </Text>
            <Text style={styles.tileDesc}>
              {voiceCapture.isSaving
                ? "Saving voice note…"
                : voiceCapture.isRecording
                  ? "Tap to stop\nrecording."
                  : "Tap to record a quick\nvoice note."}
            </Text>
          </View>
        </TouchableOpacity>

        {/* Bottom-right: Exit */}
        <TouchableOpacity style={[styles.tile, styles.tileDark]} activeOpacity={0.8} onPress={() => setCarMode(false)}>
          <X size={72} color={colors.exitAccent} weight="regular" />
          <View style={styles.tileCenterText}>
            <Text style={styles.tileTitle}>Exit Car Mode</Text>
            <Text style={styles.tileExitAccent}>Return to app</Text>
            <Text style={styles.tileDesc}>Leave car mode and{"\n"}return to Root.</Text>
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: 16,
    gap: 10,
  },
  header: {
    alignItems: "center",
    paddingVertical: 2,
  },
  headerLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.muted,
    letterSpacing: 2,
  },
  row: {
    flex: 1,
    flexDirection: "row",
    gap: 12,
  },
  tile: {
    flex: 1,
    borderRadius: 20,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    padding: 16,
  },
  tileGreen: { backgroundColor: colors.card },
  tileDark: { backgroundColor: colors.cardDark },
  tileActive: { backgroundColor: colors.accent },
  tileDisabled: { opacity: 0.85 },
  tileOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
    padding: 16,
    justifyContent: "flex-end",
    gap: 4,
  },
  tilePlayIcon: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 60,
    alignItems: "center",
    justifyContent: "center",
  },
  tileTitleLarge: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.foreground,
  },
  tileAccentSmall: {
    fontSize: 13,
    color: colors.accent,
    fontWeight: "600",
  },
  tileEpisodeTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.foreground,
    lineHeight: 18,
  },
  tileShow: {
    fontSize: 12,
    color: colors.mutedLight,
  },
  progressBar: {
    height: 3,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: {
    height: 3,
    backgroundColor: colors.accent,
    borderRadius: 2,
  },
  timesRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  timeText: {
    fontSize: 11,
    color: colors.accent,
    fontVariant: ["tabular-nums"],
  },
  tileCenterText: {
    alignItems: "center",
    gap: 4,
  },
  tileTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.foreground,
    textAlign: "center",
  },
  tileAccent: {
    fontSize: 13,
    color: colors.accent,
    fontWeight: "600",
    textAlign: "center",
  },
  tileExitAccent: {
    fontSize: 13,
    color: colors.exitAccent,
    fontWeight: "600",
    textAlign: "center",
  },
  tileDesc: {
    fontSize: 12,
    color: colors.mutedLight,
    textAlign: "center",
    lineHeight: 18,
    marginTop: 4,
  },
  waveform: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    height: 72,
  },
  waveBar: {
    width: 7,
    borderRadius: 4,
    backgroundColor: colors.mutedLight,
  },
  pauseIcon: {
    flexDirection: "row",
    gap: 10,
    height: 64,
    alignItems: "center",
  },
  pauseBar: {
    width: 14,
    height: 52,
    borderRadius: 6,
    backgroundColor: colors.foreground,
  },
  playIconWrapper: {
    width: 64,
    height: 64,
    alignItems: "center",
    justifyContent: "center",
  },
  playIconTriangle: {
    width: 0,
    height: 0,
    borderTopWidth: 28,
    borderBottomWidth: 28,
    borderLeftWidth: 48,
    borderTopColor: "transparent",
    borderBottomColor: "transparent",
    borderLeftColor: colors.foreground,
    marginLeft: 8,
  },
});
