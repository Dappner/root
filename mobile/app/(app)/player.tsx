import { usePlayer } from "@/features/player/context";
import { useOfflineStore } from "@/features/offline";
import { usePlayerTranscript } from "@/features/player/use-player-transcript";
import { PlayerTranscriptView } from "@/features/player/player-transcript-view";

type DownloadStatus = "idle" | "checking" | "downloading" | "done" | "error";
import { useVoiceCapture } from "@/features/player/voice-capture";
import { ArrowCounterClockwise } from "phosphor-react-native/src/icons/ArrowCounterClockwise";
import { ArrowClockwise } from "phosphor-react-native/src/icons/ArrowClockwise";
import { Play } from "phosphor-react-native/src/icons/Play";
import { Pause } from "phosphor-react-native/src/icons/Pause";
import { CheckCircle } from "phosphor-react-native/src/icons/CheckCircle";
import { PlusCircle } from "phosphor-react-native/src/icons/PlusCircle";
import { Microphone } from "phosphor-react-native/src/icons/Microphone";
import { BookOpen } from "phosphor-react-native/src/icons/BookOpen";
import { Car } from "phosphor-react-native/src/icons/Car";
import { CaretDown } from "phosphor-react-native/src/icons/CaretDown";
import { CaretUp } from "phosphor-react-native/src/icons/CaretUp";
import { DotsThree } from "phosphor-react-native/src/icons/DotsThree";
import { Quotes } from "phosphor-react-native/src/icons/Quotes";
import { RecordingOverlay } from "@/features/player/recording-overlay";
import { CarModeOverlay } from "@/features/player/car-mode-overlay";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Alert,
  Image,
  PanResponder,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const colors = {
  background: "#FAF5EB",
  card: "#FCFCF5",
  foreground: "#2C2C2C",
  muted: "#666050",
  border: "#C9C0A8",
  secondary: "#E4DBC5",
  primary: "#3F6B51",
  primaryForeground: "#FFFFFF",
};

const SPEEDS = [0.75, 1, 1.25, 1.5, 2];

function formatTime(sec: number) {
  const s = Math.floor(sec);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}:${String(m % 60).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

function formatPublishedDate(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

export default function PlayerScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    track, isPlaying, isLoading, positionSec, durationSec,
    togglePlayPause, seekTo, skipBack, skipForward, setRate, rate,
    isCarMode, setCarMode,
  } = usePlayer();
  const voiceCapture = useVoiceCapture();
  const offline = useOfflineStore();

  const [downloadStatus, setDownloadStatus] = useState<DownloadStatus>("checking");
  const [showTranscript, setShowTranscript] = useState(false);
  const scrubberRef = useRef<View>(null);
  const scrubberWidth = useRef(0);
  const seekToRef = useRef(seekTo);
  const durationSecRef = useRef(durationSec);
  useEffect(() => { seekToRef.current = seekTo; }, [seekTo]);
  useEffect(() => { durationSecRef.current = durationSec; }, [durationSec]);

  const scrubberPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 2,
      onPanResponderGrant: (e) => {
        const w = scrubberWidth.current;
        if (w <= 0) return;
        const x = Math.max(0, Math.min(e.nativeEvent.locationX, w));
        seekToRef.current((x / w) * durationSecRef.current);
      },
      onPanResponderMove: (e) => {
        const w = scrubberWidth.current;
        if (w <= 0) return;
        const x = Math.max(0, Math.min(e.nativeEvent.locationX, w));
        seekToRef.current((x / w) * durationSecRef.current);
      },
    })
  ).current;

  useEffect(() => {
    if (!track?.source.id) return;
    setDownloadStatus(offline.isSourceDownloaded(track.source.id) ? "done" : "idle");
  }, [track?.source.id, offline, offline.version]);

  const transcriptState = usePlayerTranscript({
    sourceId: track?.source.id ?? null,
    episodeId: track?.episode.id ?? null,
    enabled: !!track?.episode.id,
  });

  if (!track) {
    router.back();
    return null;
  }

  if (isCarMode) {
    return <CarModeOverlay topInset={insets.top} bottomInset={insets.bottom} />;
  }

  const progress = durationSec > 0 ? positionSec / durationSec : 0;
  const imageUrl = track.episode.image_url ?? track.source.image_url;
  const nextSpeed = SPEEDS[(SPEEDS.indexOf(rate) + 1) % SPEEDS.length];
  const publishedAt = formatPublishedDate(track.episode.published_at ?? track.source.created_at);
  const transcriptAvailable = !!transcriptState.transcript && transcriptState.transcript.utterances.length > 0;

  const handleDownload = async () => {
    if (!track) return;
    const inLibrary = track.source.id !== 0;
    if (!inLibrary) {
      Alert.alert(
        "Save & Download",
        "This will add the episode to your library and download it for offline listening.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Save & Download", onPress: doDownload },
        ]
      );
      return;
    }
    doDownload();
  };

  const doDownload = async () => {
    if (!track) return;
    setDownloadStatus("downloading");
    try {
      await offline.downloadSource({
        source: track.source,
        episode: track.episode,
        transcript: track.transcript ?? null,
      });
      setDownloadStatus("done");
    } catch {
      setDownloadStatus("error");
      Alert.alert("Download failed", "Could not download this episode.");
    }
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={styles.topBarIcon}
        >
          <CaretDown size={22} color={colors.foreground} weight="bold" />
        </TouchableOpacity>
        <View style={styles.topBarTitleWrap}>
          <Text style={styles.topBarTitle} numberOfLines={1}>{track.source.title}</Text>
        </View>
        <TouchableOpacity
          onPress={track.source.id !== 0 ? () => { router.back(); router.push(`/sources/${track.source.id}`); } : undefined}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={styles.topBarIcon}
        >
          <DotsThree size={26} color={track.source.id !== 0 ? colors.foreground : "transparent"} weight="bold" />
        </TouchableOpacity>
      </View>

      {showTranscript ? (
        <View style={styles.transcriptHeader}>
          <View style={styles.transcriptMiniCard}>
            {imageUrl ? (
              <Image source={{ uri: imageUrl }} style={styles.transcriptMiniThumb} resizeMode="cover" />
            ) : (
              <View style={[styles.transcriptMiniThumb, styles.showThumbPlaceholder]}>
                <Text style={styles.showThumbText}>{track.source.title.slice(0, 1).toUpperCase()}</Text>
              </View>
            )}
            <View style={styles.transcriptMiniText}>
              <Text style={styles.transcriptMiniTitle} numberOfLines={1}>{track.episode.title}</Text>
              <Text style={styles.transcriptMiniShow} numberOfLines={1}>{track.source.title}</Text>
            </View>
            <TouchableOpacity
              onPress={() => setShowTranscript(false)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={styles.transcriptCollapseBtn}
            >
              <CaretUp size={18} color={colors.foreground} weight="bold" />
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={styles.artworkWrap}>
          {imageUrl ? (
            <Image source={{ uri: imageUrl }} style={styles.artwork} resizeMode="cover" />
          ) : (
            <View style={[styles.artwork, styles.artworkPlaceholder]}>
              <Text style={styles.artworkPlaceholderText}>♪</Text>
            </View>
          )}
          {(transcriptAvailable || transcriptState.transcriptLoading) && (
            <TouchableOpacity
              onPress={() => setShowTranscript(true)}
              style={styles.transcriptPill}
              activeOpacity={0.85}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Quotes size={14} color={colors.primaryForeground} weight="fill" />
              <Text style={styles.transcriptPillText} numberOfLines={1}>
                {transcriptState.transcriptLoading ? "Loading transcript…" : "Transcript"}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {showTranscript ? (
        <View style={styles.transcriptBody}>
          <PlayerTranscriptView
            transcript={transcriptState.transcript}
            transcriptLoading={transcriptState.transcriptLoading}
            transcriptProcessing={transcriptState.transcriptProcessing}
            triggering={transcriptState.triggering}
            onTriggerGeneration={transcriptState.triggerGeneration}
            positionSec={positionSec}
            onSeek={seekTo}
          />
        </View>
      ) : (
        <View style={styles.infoBlock}>
          {publishedAt ? <Text style={styles.dateText}>{publishedAt}</Text> : null}
          <Text style={styles.episodeTitle} numberOfLines={2}>{track.episode.title}</Text>
          <Text style={styles.showTitle} numberOfLines={1}>{track.source.title}</Text>
        </View>
      )}

      {/* Scrubber */}
      <View style={styles.scrubberBlock}>
        <View
          ref={scrubberRef}
          style={styles.scrubberTrack}
          onLayout={(e) => { scrubberWidth.current = e.nativeEvent.layout.width; }}
          {...scrubberPan.panHandlers}
        >
          <View style={styles.scrubberTrackBg} />
          <View style={[styles.scrubberFill, { width: `${progress * 100}%` }]} />
          <View style={[styles.scrubberThumb, { left: `${progress * 100}%` as any }]} />
        </View>
        <View style={styles.timeRow}>
          <Text style={styles.timeText}>{formatTime(positionSec)}</Text>
          <Text style={styles.timeText}>-{formatTime(Math.max(0, durationSec - positionSec))}</Text>
        </View>
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        <TouchableOpacity onPress={() => setRate(nextSpeed)} style={styles.speedButton} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={styles.speedText}>{rate}×</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => skipBack(15)} style={styles.skipButton}>
          <ArrowCounterClockwise size={40} color={colors.foreground} weight="regular" />
          <Text style={styles.skipLabel}>15</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={togglePlayPause} style={styles.playButton}>
          {isLoading ? (
            <Text style={styles.playIcon}>…</Text>
          ) : isPlaying ? (
            <Pause size={44} color={colors.foreground} weight="fill" />
          ) : (
            <Play size={44} color={colors.foreground} weight="fill" />
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => skipForward(30)} style={styles.skipButton}>
          <ArrowClockwise size={40} color={colors.foreground} weight="regular" />
          <Text style={styles.skipLabel}>30</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={downloadStatus === "done" ? undefined : handleDownload}
          disabled={downloadStatus === "downloading"}
          style={styles.iconButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          {downloadStatus === "done" ? (
            <CheckCircle size={24} color={colors.primary} weight="fill" />
          ) : (
            <PlusCircle
              size={24}
              color={downloadStatus === "downloading" ? colors.muted : colors.foreground}
              weight="regular"
            />
          )}
        </TouchableOpacity>
      </View>

      {/* Bottom row */}
      <View style={[styles.bottomRow, { paddingBottom: insets.bottom + 12 }]}>
        <TouchableOpacity
          onPress={voiceCapture.start}
          disabled={voiceCapture.isSaving || voiceCapture.isRecording}
          style={styles.bottomIconButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Microphone size={22} color={colors.foreground} weight="regular" />
          <Text style={styles.bottomIconLabel}>
            {voiceCapture.isSaving ? "Saving…" : voiceCapture.isRecording ? "Recording" : "Note"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setCarMode(true)}
          style={styles.bottomIconButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Car size={22} color={colors.foreground} weight="regular" />
          <Text style={styles.bottomIconLabel}>Car</Text>
        </TouchableOpacity>

        {track.source.id !== 0 ? (
          <TouchableOpacity
            onPress={() => { router.back(); router.push(`/sources/${track.source.id}`); }}
            style={styles.bottomIconButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <BookOpen size={22} color={colors.foreground} weight="regular" />
            <Text style={styles.bottomIconLabel}>Source</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.bottomIconButton} />
        )}
      </View>

      <RecordingOverlay />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 8,
  },
  topBarIcon: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  topBarTitleWrap: {
    flex: 1,
    alignItems: "center",
  },
  topBarTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.muted,
    letterSpacing: 0.2,
  },
  artworkWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    paddingTop: 16,
    paddingBottom: 24,
  },
  artwork: {
    width: "100%",
    aspectRatio: 1,
    maxWidth: 360,
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
  },
  artworkPlaceholder: {
    backgroundColor: colors.secondary,
    alignItems: "center",
    justifyContent: "center",
  },
  artworkPlaceholderText: { fontSize: 80, color: colors.muted },
  transcriptPill: {
    position: "absolute",
    bottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    maxWidth: "70%",
  },
  transcriptPillText: {
    color: colors.primaryForeground,
    fontWeight: "700",
    fontSize: 13,
    letterSpacing: 0.2,
  },
  transcriptHeader: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
  },
  transcriptMiniCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 10,
  },
  transcriptMiniThumb: { width: 48, height: 48, borderRadius: 8 },
  transcriptMiniText: { flex: 1, gap: 2 },
  transcriptMiniTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.foreground,
    letterSpacing: -0.1,
  },
  transcriptMiniShow: {
    fontSize: 12,
    color: colors.muted,
    fontWeight: "500",
  },
  transcriptCollapseBtn: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.secondary,
    borderRadius: 16,
  },
  transcriptBody: {
    flex: 1,
  },
  infoBlock: {
    paddingHorizontal: 24,
    gap: 4,
  },
  dateText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.muted,
  },
  showThumbPlaceholder: {
    backgroundColor: colors.secondary,
    alignItems: "center",
    justifyContent: "center",
  },
  showThumbText: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.muted,
  },
  episodeTitle: {
    fontSize: 19,
    fontWeight: "700",
    color: colors.foreground,
    letterSpacing: -0.2,
    lineHeight: 24,
  },
  showTitle: {
    fontSize: 13,
    color: colors.muted,
    fontWeight: "500",
  },
  scrubberBlock: {
    paddingHorizontal: 24,
    paddingTop: 20,
    gap: 4,
  },
  scrubberTrack: {
    height: 28,
    justifyContent: "center",
  },
  scrubberTrackBg: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.secondary,
  },
  scrubberFill: {
    position: "absolute",
    left: 0,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.primary,
  },
  scrubberThumb: {
    position: "absolute",
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.primary,
    marginLeft: -7,
    top: 7,
  },
  timeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  timeText: { fontSize: 12, color: colors.muted },
  controls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingTop: 20,
  },
  speedButton: {
    minWidth: 44,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  speedText: { fontSize: 15, fontWeight: "700", color: colors.foreground },
  skipButton: {
    alignItems: "center",
    justifyContent: "center",
    width: 56,
    height: 56,
  },
  skipLabel: {
    position: "absolute",
    fontSize: 11,
    color: colors.foreground,
    fontWeight: "700",
  },
  playButton: {
    width: 72,
    height: 72,
    alignItems: "center",
    justifyContent: "center",
  },
  playIcon: { fontSize: 32, color: colors.foreground },
  iconButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  bottomRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 18,
    marginTop: "auto",
  },
  bottomIconButton: {
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    minWidth: 64,
  },
  bottomIconLabel: {
    fontSize: 11,
    color: colors.muted,
    fontWeight: "600",
  },
});
