import { getElevenLabsConversationToken } from "./api";
import { createVoiceAgentTools } from "./tools";
import { VoiceSessionOverlay } from "./voice-session-overlay";
import { usePlayer } from "@/features/player/context";
import { authClient } from "@/lib/auth-client";
import { useRouter, usePathname } from "expo-router";
import {
  ConversationProvider,
  useConversationControls,
  useConversationStatus,
} from "@elevenlabs/react-native";
import { PermissionsAndroid, Platform } from "react-native";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

type VoiceAgentStatus = "idle" | "connecting" | "connected" | "error";

interface VoiceAgentState {
  status: VoiceAgentStatus;
  error: string | null;
  isActive: boolean;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  toggle: () => Promise<void>;
}

const VoiceAgentContext = createContext<VoiceAgentState | null>(null);

async function ensureMicPermission(): Promise<boolean> {
  if (Platform.OS !== "android") return true;
  const result = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
  );
  return result === PermissionsAndroid.RESULTS.GRANTED;
}

function VoiceAgentInner({ children }: { children: React.ReactNode }) {
  const { data: session } = authClient.useSession();
  const { pause, resume, isPlaying, play } = usePlayer();
  const router = useRouter();
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);
  const [error, setError] = useState<string | null>(null);
  const wasPlayingRef = useRef(false);
  const startedRef = useRef(false);
  const stopRef = useRef<(() => Promise<void>) | null>(null);

  const { status: sdkStatus } = useConversationStatus();
  const { startSession, endSession } = useConversationControls();

  const resumeIfNeeded = useCallback(async () => {
    if (!wasPlayingRef.current) return;
    wasPlayingRef.current = false;
    await resume();
  }, [resume]);

  const stop = useCallback(async () => {
    if (startedRef.current) {
      try {
        endSession();
      } catch (endError) {
        console.error("Failed to end ElevenLabs session", endError);
      }
    }
    startedRef.current = false;
    await resumeIfNeeded();
  }, [endSession, resumeIfNeeded]);

  useEffect(() => {
    stopRef.current = stop;
  }, [stop]);

  const start = useCallback(async () => {
    if (startedRef.current || sdkStatus === "connecting") return;

    setError(null);

    const granted = await ensureMicPermission();
    if (!granted) {
      setError("Microphone permission denied");
      return;
    }

    wasPlayingRef.current = isPlaying;
    if (isPlaying) {
      await pause();
    }

    try {
      const conversationToken = await getElevenLabsConversationToken();
      startedRef.current = true;
      startSession({
        conversationToken,
        connectionType: "webrtc",
        userId: session?.user.id,
        clientTools: createVoiceAgentTools({
          play,
          onPlaybackStarted: () => {
            if (pathnameRef.current === "/player") return;
            router.push("/player");
          },
        }),
        onConnect: ({ conversationId }) => {
          console.log("ElevenLabs conversation connected", conversationId);
          startedRef.current = true;
        },
        onDisconnect: (details) => {
          console.log("ElevenLabs conversation disconnected", details);
          startedRef.current = false;
          void resumeIfNeeded();
        },
        onError: (message) => {
          console.error("ElevenLabs conversation error", message);
          startedRef.current = false;
          setError(message);
          void resumeIfNeeded();
        },
        onStatusChange: ({ status }) => {
          console.log("ElevenLabs conversation status", status);
        },
        onMessage: (message) => {
          console.log("ElevenLabs conversation message", message);
        },
      });
    } catch (startError) {
      startedRef.current = false;
      const message =
        startError instanceof Error ? startError.message : "Voice setup failed";
      console.error("Voice agent setup failed", startError);
      setError(message);
      await resumeIfNeeded();
    }
  }, [
    isPlaying,
    pause,
    play,
    resumeIfNeeded,
    router,
    sdkStatus,
    session?.user.id,
    startSession,
  ]);

  const toggle = useCallback(async () => {
    if (startedRef.current || sdkStatus === "connected") {
      await stop();
      return;
    }
    await start();
  }, [sdkStatus, start, stop]);

  useEffect(() => {
    if (sdkStatus === "disconnected") {
      startedRef.current = false;
      void resumeIfNeeded();
    }
  }, [resumeIfNeeded, sdkStatus]);

  useEffect(() => {
    return () => {
      void stopRef.current?.();
    };
  }, []);

  const status: VoiceAgentStatus = error
    ? "error"
    : sdkStatus === "connected"
      ? "connected"
      : sdkStatus === "connecting"
        ? "connecting"
        : "idle";

  return (
    <VoiceAgentContext.Provider
      value={{
        status,
        error,
        isActive: status === "connecting" || status === "connected",
        start,
        stop,
        toggle,
      }}
    >
      {children}
      <VoiceSessionOverlay />
    </VoiceAgentContext.Provider>
  );
}

export function VoiceAgentProvider({ children }: { children: React.ReactNode }) {
  return (
    <ConversationProvider>
      <VoiceAgentInner>{children}</VoiceAgentInner>
    </ConversationProvider>
  );
}

export function useVoiceAgent() {
  const ctx = useContext(VoiceAgentContext);
  if (!ctx) throw new Error("useVoiceAgent must be used within VoiceAgentProvider");
  return ctx;
}
