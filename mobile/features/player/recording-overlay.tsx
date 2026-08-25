import { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useVoiceCapture } from "./voice-capture";

const colors = {
  card: "#FCFCF5",
  primaryForeground: "#FFFFFF",
  warning: "#FF6B6B",
  mutedLight: "#E4DBC5",
};

function formatTime(sec: number) {
  const s = Math.floor(sec);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

export function RecordingOverlay() {
  const { isRecording, elapsedSec, maxSec, stop } = useVoiceCapture();
  const waveAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!isRecording) {
      waveAnim.stopAnimation();
      waveAnim.setValue(0);
      return;
    }
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(waveAnim, { toValue: 1, duration: 650, useNativeDriver: true }),
        Animated.timing(waveAnim, { toValue: 0, duration: 650, useNativeDriver: true }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [isRecording, waveAnim]);

  if (!isRecording) return null;

  const isWarning = elapsedSec >= maxSec - 10;

  return (
    <TouchableOpacity style={styles.recordingOverlay} activeOpacity={0.95} onPress={stop}>
      <View style={styles.recordingContent}>
        <View style={styles.waveRow}>
          {[0, 1, 2, 3, 4].map((bar) => (
            <Animated.View
              key={bar}
              style={[
                styles.waveBar,
                {
                  transform: [
                    {
                      scaleY: waveAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.45 + bar * 0.08, 1.45 - bar * 0.08],
                      }),
                    },
                  ],
                },
              ]}
            />
          ))}
        </View>
        <Text style={styles.recordingTitle}>Recording</Text>
        <View style={styles.recordingTimerRow}>
          <Text style={[styles.recordingTimer, isWarning && styles.recordingTimerWarning]}>
            {formatTime(elapsedSec)}
          </Text>
          <Text style={[styles.recordingTimerMax, isWarning && styles.recordingTimerWarning]}>
            / {formatTime(maxSec)}
          </Text>
        </View>
        <Text style={styles.recordingHint}>Tap anywhere to stop</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  recordingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(44, 44, 44, 0.88)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  recordingContent: {
    alignItems: "center",
    gap: 18,
  },
  waveRow: {
    height: 120,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  waveBar: {
    width: 14,
    height: 72,
    borderRadius: 7,
    backgroundColor: colors.card,
  },
  recordingTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: colors.primaryForeground,
  },
  recordingTimerRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 4,
  },
  recordingTimer: {
    fontSize: 28,
    fontWeight: "700",
    color: colors.primaryForeground,
    fontVariant: ["tabular-nums"],
  },
  recordingTimerMax: {
    fontSize: 16,
    fontWeight: "400",
    color: colors.mutedLight,
    fontVariant: ["tabular-nums"],
  },
  recordingTimerWarning: {
    color: colors.warning,
  },
  recordingHint: {
    fontSize: 14,
    color: colors.mutedLight,
  },
});
