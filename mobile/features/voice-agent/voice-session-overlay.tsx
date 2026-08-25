import { useVoiceAgent } from "./context";
import { useConversationMode } from "@elevenlabs/react-native";
import { usePathname } from "expo-router";
import { X } from "phosphor-react-native/src/icons/X";
import { useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const colors = {
  background: "#0a0f0d",
  foreground: "#FFFFFF",
  muted: "#7a8a82",
  accent: "#4ade80",
  accentDim: "rgba(74, 222, 128, 0.35)",
  endBg: "rgba(239, 68, 68, 0.18)",
  endText: "#fca5a5",
};

type DisplayState = "connecting" | "listening" | "speaking" | "error";

function statusLabel(state: DisplayState, error: string | null): string {
  if (error) return "Connection lost";
  switch (state) {
    case "connecting":
      return "Connecting…";
    case "speaking":
      return "Speaking…";
    case "listening":
      return "Listening…";
    case "error":
      return "Error";
  }
}

function statusSubtext(state: DisplayState, error: string | null): string {
  if (error) return error;
  if (state === "connecting") return "Setting up your voice session.";
  if (state === "speaking") return "Root is responding.";
  return "Speak naturally. I'm listening.";
}

function PulsingOrb({ active, fast }: { active: boolean; fast: boolean }) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!active) {
      pulse.stopAnimation();
      pulse.setValue(0);
      return;
    }
    const duration = fast ? 700 : 1400;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [active, fast, pulse]);

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1.08] });
  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] });
  const haloScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.25] });
  const haloOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] });

  return (
    <View style={styles.orbContainer}>
      <Animated.View style={[styles.orbHalo, { transform: [{ scale: haloScale }], opacity: haloOpacity }]} />
      <Animated.View style={[styles.orb, { transform: [{ scale }], opacity }]}>
        <View style={styles.orbInner} />
      </Animated.View>
    </View>
  );
}

interface VoiceSessionOverlayProps {
  /**
   * Scope where this instance is mounted. The root-level instance hides while
   * the player modal is open so a player-scoped instance can render on top of
   * the native modal layer.
   */
  scope?: "root" | "player";
}

export function VoiceSessionOverlay({ scope = "root" }: VoiceSessionOverlayProps = {}) {
  const { status, error, stop } = useVoiceAgent();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();

  const visible = status === "connecting" || status === "connected" || status === "error";
  const playerOpen = pathname === "/player";
  if (!visible) return null;
  if (scope === "root" && playerOpen) return null;
  if (scope === "player" && !playerOpen) return null;

  return (
    <View
      style={[styles.screen, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 32 }]}
      pointerEvents="auto"
    >
      <View style={styles.topRow}>
        <TouchableOpacity style={styles.endButton} activeOpacity={0.75} onPress={() => void stop()}>
          <X size={16} color={colors.endText} weight="bold" />
          <Text style={styles.endText}>End</Text>
        </TouchableOpacity>
      </View>

      <OrbAndStatus status={status} error={error} />

      <View style={styles.footer}>
        <Text style={styles.footerText}>{statusSubtext(displayState(status), error)}</Text>
      </View>
    </View>
  );
}

function displayState(status: ReturnType<typeof useVoiceAgent>["status"]): DisplayState {
  if (status === "error") return "error";
  if (status === "connecting") return "connecting";
  return "listening";
}

function OrbAndStatus({
  status,
  error,
}: {
  status: ReturnType<typeof useVoiceAgent>["status"];
  error: string | null;
}) {
  const connected = status === "connected";
  // useConversationMode is safe to call only inside ConversationProvider;
  // VoiceSessionOverlay is rendered inside VoiceAgentProvider which wraps it.
  const mode = useConversationMode();

  const state: DisplayState = error
    ? "error"
    : status === "connecting"
      ? "connecting"
      : connected && mode.isSpeaking
        ? "speaking"
        : "listening";

  return (
    <View style={styles.center}>
      <PulsingOrb active={status !== "error"} fast={state === "speaking"} />
      <Text style={styles.statusText}>{statusLabel(state, error)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.background,
    paddingHorizontal: 20,
    zIndex: 9999,
    elevation: 30,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
  },
  endButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.endBg,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  endText: {
    color: colors.endText,
    fontWeight: "700",
    fontSize: 14,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 36,
  },
  orbContainer: {
    width: 260,
    height: 260,
    alignItems: "center",
    justifyContent: "center",
  },
  orbHalo: {
    position: "absolute",
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: colors.accentDim,
  },
  orb: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: "transparent",
    borderWidth: 2,
    borderColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  orbInner: {
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: colors.accentDim,
  },
  statusText: {
    color: colors.accent,
    fontSize: 22,
    fontWeight: "600",
  },
  footer: {
    alignItems: "center",
    paddingBottom: 8,
  },
  footerText: {
    color: colors.muted,
    fontSize: 14,
    textAlign: "center",
  },
});
