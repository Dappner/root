import {
  AudioQuality,
  IOSOutputFormat,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  type RecordingOptions,
} from "expo-audio";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Alert, Vibration } from "react-native";
import { usePlayer } from "./context";
import { useOfflineStore } from "@/features/offline";

const MAX_RECORDING_SECONDS = 90;

const VOICE_RECORDING_OPTIONS: RecordingOptions = {
  extension: ".m4a",
  sampleRate: 16000,
  numberOfChannels: 1,
  bitRate: 48000,
  android: {
    extension: ".m4a",
    outputFormat: "mpeg4",
    audioEncoder: "aac",
    sampleRate: 16000,
  },
  ios: {
    extension: ".m4a",
    outputFormat: IOSOutputFormat.MPEG4AAC,
    audioQuality: AudioQuality.MEDIUM,
    sampleRate: 16000,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  web: {
    mimeType: "audio/mp4",
    bitsPerSecond: 48000,
  },
};

interface VoiceCaptureState {
  isRecording: boolean;
  isSaving: boolean;
  elapsedSec: number;
  maxSec: number;
  start: () => Promise<void>;
  stop: () => Promise<void>;
}

const VoiceCaptureContext = createContext<VoiceCaptureState | null>(null);

export function VoiceCaptureProvider({ children }: { children: React.ReactNode }) {
  const { track, isPlaying, positionSec, pause, resume } = usePlayer();
  const offline = useOfflineStore();

  const [isRecording, setIsRecording] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);

  const recorder = useAudioRecorder(VOICE_RECORDING_OPTIONS);
  const isRecordingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const wasPlayingRef = useRef(false);
  const positionAtStartRef = useRef(0);
  const trackRef = useRef(track);
  useEffect(() => { trackRef.current = track; }, [track]);

  const stop = useCallback(async () => {
    const trk = trackRef.current;
    if (!isRecordingRef.current || !trk?.source.id) return;

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    isRecordingRef.current = false;
    setIsRecording(false);
    setElapsedSec(0);
    await recorder.stop();
    const uri = recorder.uri;
    await setAudioModeAsync({
      allowsRecording: false,
      shouldPlayInBackground: true,
      playsInSilentMode: true,
    });
    if (wasPlayingRef.current) {
      await resume();
    }
    if (!uri) {
      Alert.alert("Recording failed", "Could not read the saved voice note.");
      return;
    }

    setIsSaving(true);
    try {
      await offline.enqueueVoiceNote({
        sourceId: trk.source.id,
        episodeId: trk.episode.id,
        playbackPositionSeconds: positionAtStartRef.current,
        recordedAt: new Date().toISOString(),
        tempUri: uri,
      });
    } catch (err) {
      Alert.alert(
        "Could not save voice note",
        err instanceof Error ? err.message : "Unknown error."
      );
      setIsSaving(false);
      return;
    }
    setIsSaving(false);
    void offline.processOutbox();
  }, [offline, recorder, resume]);

  const start = useCallback(async () => {
    const trk = trackRef.current;
    if (!trk?.source.id) return;
    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Microphone blocked", "Enable microphone access to record a voice note.");
      return;
    }

    wasPlayingRef.current = isPlaying;
    positionAtStartRef.current = positionSec;
    await pause();
    await setAudioModeAsync({
      allowsRecording: true,
      shouldPlayInBackground: true,
      playsInSilentMode: true,
    });
    await recorder.prepareToRecordAsync(VOICE_RECORDING_OPTIONS);
    recorder.record();
    isRecordingRef.current = true;
    setElapsedSec(0);
    setIsRecording(true);

    let elapsed = 0;
    timerRef.current = setInterval(() => {
      elapsed += 1;
      setElapsedSec(elapsed);
      if (elapsed >= MAX_RECORDING_SECONDS - 10 && elapsed < MAX_RECORDING_SECONDS) {
        Vibration.vibrate(80);
      }
      if (elapsed >= MAX_RECORDING_SECONDS) {
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        stop();
      }
    }, 1000);
  }, [isPlaying, positionSec, pause, recorder, stop]);

  return (
    <VoiceCaptureContext.Provider
      value={{ isRecording, isSaving, elapsedSec, maxSec: MAX_RECORDING_SECONDS, start, stop }}
    >
      {children}
    </VoiceCaptureContext.Provider>
  );
}

export function useVoiceCapture() {
  const ctx = useContext(VoiceCaptureContext);
  if (!ctx) throw new Error("useVoiceCapture must be used within VoiceCaptureProvider");
  return ctx;
}
