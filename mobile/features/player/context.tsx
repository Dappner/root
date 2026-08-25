import TrackPlayer, {
  Capability,
  Event,
  State,
  useIsPlaying,
  useProgress,
  useTrackPlayerEvents,
} from "react-native-track-player";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { AppState } from "react-native";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type { TranscriptData } from "@/lib/api/rag-generated";
import type { SourceDTO } from "@/lib/api/rag-generated";
import type { PodcastEpisodeDTO } from "@/features/podcasts/types";
import { SourceDTOStatus } from "@/lib/api/rag-generated";
import { updateSourcePlaybackProgressRagApiPlaybackSourcesSourceIdProgressPut } from "@/lib/api/rag-generated";
import {
  readLocalTranscript as fsReadLocalTranscript,
  resolveLocalAudioUri,
} from "@/features/offline/backends/fs/sources";
import { homeKeys } from "@/features/home/hooks";
import { sourcesApi } from "@/features/sources/api";
import { sourcesKeys } from "@/features/sources/hooks";
import { PLAYBACK_COMPLETE_PROGRESS } from "@/lib/utils";

const SAVE_INTERVAL_SEC = 10;
const PROGRESS_UPDATE_INTERVAL_MS = 500;

// TrackPlayer.setupPlayer() may only be called once per app session — it
// throws if the player is already initialized. We guard it with a module-level
// promise so concurrent/repeated calls (e.g. fast remounts) all await the same
// setup and we never call it twice.
let setupPromise: Promise<void> | null = null;

async function ensurePlayerSetup(): Promise<void> {
  if (setupPromise) return setupPromise;
  setupPromise = (async () => {
    try {
      await TrackPlayer.setupPlayer();
    } catch (err) {
      // Already initialized — safe to ignore. Any other error we re-throw so
      // setup can be retried on the next call.
      const message = err instanceof Error ? err.message : String(err);
      if (!/already been initialized|already initialized/i.test(message)) {
        setupPromise = null;
        throw err;
      }
    }
    await TrackPlayer.updateOptions({
      progressUpdateEventInterval: PROGRESS_UPDATE_INTERVAL_MS / 1000,
      capabilities: [
        Capability.Play,
        Capability.Pause,
        Capability.SeekTo,
        Capability.JumpBackward,
        Capability.JumpForward,
      ],
      compactCapabilities: [
        Capability.Play,
        Capability.Pause,
        Capability.JumpBackward,
        Capability.JumpForward,
      ],
      notificationCapabilities: [
        Capability.Play,
        Capability.Pause,
        Capability.SeekTo,
        Capability.JumpBackward,
        Capability.JumpForward,
      ],
    });
  })();
  return setupPromise;
}

function patchSourceMetadata(
  queryClient: QueryClient,
  sourceId: number,
  positionSec: number,
  durationSec: number,
) {
  const position = Math.floor(positionSec);
  const duration = durationSec > 0 ? Math.floor(durationSec) : undefined;
  const nowIso = new Date().toISOString();

  const apply = (source: SourceDTO): SourceDTO => {
    const metadata = { ...(source.metadata ?? {}) } as Record<string, unknown>;
    metadata.current_position = position;
    const lastKey = source.type === "video" ? "last_watched_at" : "last_listened_at";
    metadata[lastKey] = nowIso;
    if (duration !== undefined) {
      metadata.duration = duration;
      metadata.completed = duration > 0 && position / duration >= PLAYBACK_COMPLETE_PROGRESS;
    }
    return { ...source, metadata, updated_at: nowIso };
  };

  queryClient.setQueryData<SourceDTO | undefined>(sourcesKeys.detail(sourceId), (prev) =>
    prev ? apply(prev) : prev,
  );
  queryClient.setQueryData<SourceDTO[] | undefined>(sourcesKeys.list(), (prev) =>
    prev?.map((s) => (s.id === sourceId ? apply(s) : s)),
  );
}

export interface PlayerTrack {
  episode: PodcastEpisodeDTO;
  source: SourceDTO;
  transcript: TranscriptData | null;
}

interface PlayerState {
  track: PlayerTrack | null;
  isPlaying: boolean;
  positionSec: number;
  durationSec: number;
  isLoading: boolean;
  rate: number;
  isCarMode: boolean;
  play: (track: PlayerTrack, initialPositionSec?: number) => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  togglePlayPause: () => Promise<void>;
  seekTo: (seconds: number) => Promise<void>;
  skipBack: (seconds?: number) => Promise<void>;
  skipForward: (seconds?: number) => Promise<void>;
  setRate: (rate: number) => Promise<void>;
  setCarMode: (active: boolean) => void;
  dismiss: () => Promise<void>;
}

const PlayerContext = createContext<PlayerState | null>(null);

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const [track, setTrack] = useState<PlayerTrack | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [positionSec, setPositionSec] = useState(0);
  const [durationSec, setDurationSec] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [rate, setRateState] = useState(1);
  const [isCarMode, setIsCarMode] = useState(false);
  const queryClient = useQueryClient();

  // Refs for use in callbacks/intervals without stale closure issues
  const positionRef = useRef(0);
  const durationRef = useRef(0);
  const trackRef = useRef<PlayerTrack | null>(null);
  const isPlayingRef = useRef(false);
  const statusTransitionRef = useRef<{ sourceId: number; status: SourceDTO["status"] } | null>(null);
  const saveSeqRef = useRef(0);
  const lastAppliedSeqRef = useRef(0);
  // True only while a track is loaded in the player queue. Guards the
  // useProgress/useIsPlaying effects from acting on stale "no track" state and
  // lets us no-op transport controls when nothing is loaded.
  const hasTrackRef = useRef(false);

  const savePlaybackProgressRef = useRef<
    (sourceId: number, positionSec: number, durationSec: number, isPlaying: boolean) => void
  >(() => {});
  savePlaybackProgressRef.current = (sourceId, positionSec, durationSec, isPlaying) => {
    const seq = ++saveSeqRef.current;
    patchSourceMetadata(queryClient, sourceId, positionSec, durationSec);
    void updateSourcePlaybackProgressRagApiPlaybackSourcesSourceIdProgressPut(sourceId, {
      position_seconds: Math.floor(positionSec),
      duration_seconds: durationSec > 0 ? Math.floor(durationSec) : undefined,
      is_playing: isPlaying,
    })
      .then(() => {
        if (seq > lastAppliedSeqRef.current) lastAppliedSeqRef.current = seq;
      })
      .catch((err) => {
        console.warn("[player] failed to save playback progress", err);
      });
  };
  const savePlaybackProgress = useCallback(
    (sourceId: number, positionSec: number, durationSec: number, isPlaying: boolean) => {
      savePlaybackProgressRef.current(sourceId, positionSec, durationSec, isPlaying);
    },
    [],
  );

  // Ensure the native player is initialized as soon as the provider mounts so
  // play() never races setup. setupPlayer() also handles the audio session /
  // background mode (no expo-av setAudioModeAsync needed).
  useEffect(() => {
    void ensurePlayerSetup();
  }, []);

  const unloadCurrent = useCallback(async () => {
    hasTrackRef.current = false;
    await TrackPlayer.reset();
  }, []);

  const updateSourceStatusCache = useCallback((source: SourceDTO, status: SourceDTO["status"]) => {
    const now = new Date().toISOString();
    const updated: SourceDTO = {
      ...source,
      status,
      updated_at: now,
      ...(status === SourceDTOStatus.in_progress
        ? { started_at: source.started_at ?? now, last_active_at: now }
        : {}),
      ...(status === SourceDTOStatus.reflecting
        ? { reflecting_at: source.reflecting_at ?? now }
        : {}),
    };

    queryClient.setQueryData(sourcesKeys.detail(source.id), updated);
    queryClient.setQueryData<SourceDTO[] | undefined>(sourcesKeys.list(), (old) =>
      old?.map((item) => (item.id === source.id ? updated : item))
    );

    if (trackRef.current?.source.id === source.id) {
      trackRef.current = { ...trackRef.current, source: updated };
      setTrack((current) =>
        current?.source.id === source.id ? { ...current, source: updated } : current
      );
    }
  }, [queryClient]);

  const invalidateSourceStatus = useCallback((sourceId: number) => {
    queryClient.invalidateQueries({ queryKey: sourcesKeys.detail(sourceId) });
    queryClient.invalidateQueries({ queryKey: sourcesKeys.list() });
    queryClient.invalidateQueries({ queryKey: homeKeys.all });
  }, [queryClient]);

  const transitionSourceStatus = useCallback((
    source: SourceDTO,
    status: SourceDTO["status"],
    persist: () => Promise<void>
  ) => {
    const existing = statusTransitionRef.current;
    if (existing?.sourceId === source.id && existing.status === status) return;

    statusTransitionRef.current = { sourceId: source.id, status };
    updateSourceStatusCache(source, status);
    void persist()
      .catch(() => {})
      .finally(() => invalidateSourceStatus(source.id));
  }, [invalidateSourceStatus, updateSourceStatusCache]);

  const play = useCallback(async (newTrack: PlayerTrack, initialPositionSec?: number) => {
    // Set track/loading state synchronously (before any await) so the player
    // screen has a track to render the instant it's navigated to — callers open
    // the player immediately and let audio buffer in the background.
    statusTransitionRef.current = null;
    setIsLoading(true);
    setTrack(newTrack);
    trackRef.current = newTrack;
    setPositionSec(initialPositionSec ?? 0);
    setDurationSec(0);
    positionRef.current = initialPositionSec ?? 0;
    durationRef.current = 0;

    await ensurePlayerSetup();
    await unloadCurrent();

    // Prefer local file, fall back to stream
    const localUri = resolveLocalAudioUri(newTrack.source.id);
    const uri = localUri ?? newTrack.episode.enclosure_url;

    if (!uri) {
      setIsLoading(false);
      return;
    }

    const knownDuration = newTrack.episode.duration ?? newTrack.source.duration;
    await TrackPlayer.add({
      url: uri,
      title: newTrack.episode.title ?? newTrack.source.title,
      artist: newTrack.source.title,
      artwork: newTrack.episode.image_url ?? newTrack.source.image_url,
      duration: knownDuration && knownDuration > 0 ? knownDuration : undefined,
    });
    hasTrackRef.current = true;

    if (newTrack.source.status === SourceDTOStatus.todo) {
      transitionSourceStatus(newTrack.source, SourceDTOStatus.in_progress, () =>
        sourcesApi.start(newTrack.source.id)
      );
    }
    if (rate !== 1) await TrackPlayer.setRate(rate);
    if (initialPositionSec && initialPositionSec > 0) {
      await TrackPlayer.seekTo(initialPositionSec);
    }
    await TrackPlayer.play();
    setIsLoading(false);
    setIsPlaying(true);
    isPlayingRef.current = true;
    savePlaybackProgress(newTrack.source.id, initialPositionSec ?? 0, 0, true);
  }, [unloadCurrent, rate, transitionSourceStatus, savePlaybackProgress]);

  const togglePlayPause = useCallback(async () => {
    if (!hasTrackRef.current) return;
    if (isPlaying) {
      await TrackPlayer.pause();
      if (trackRef.current) savePlaybackProgress(trackRef.current.source.id, positionRef.current, durationRef.current, false);
    } else {
      await TrackPlayer.play();
    }
  }, [isPlaying, savePlaybackProgress]);

  const pause = useCallback(async () => {
    if (!hasTrackRef.current) return;
    await TrackPlayer.pause();
    if (trackRef.current) savePlaybackProgress(trackRef.current.source.id, positionRef.current, durationRef.current, false);
  }, [savePlaybackProgress]);

  const resume = useCallback(async () => {
    if (!hasTrackRef.current) return;
    await TrackPlayer.play();
  }, []);

  const seekTo = useCallback(async (seconds: number) => {
    if (!hasTrackRef.current) return;
    await TrackPlayer.seekTo(seconds);
  }, []);

  const skipBack = useCallback(async (seconds = 15) => {
    await seekTo(Math.max(0, positionSec - seconds));
  }, [seekTo, positionSec]);

  const skipForward = useCallback(async (seconds = 30) => {
    await seekTo(Math.min(durationSec, positionSec + seconds));
  }, [seekTo, positionSec, durationSec]);

  const setRate = useCallback(async (newRate: number) => {
    setRateState(newRate);
    if (hasTrackRef.current) await TrackPlayer.setRate(newRate);
  }, []);

  const setCarMode = useCallback((active: boolean) => {
    setIsCarMode(active);
  }, []);

  const dismiss = useCallback(async () => {
    if (trackRef.current) savePlaybackProgress(trackRef.current.source.id, positionRef.current, durationRef.current, false);
    await unloadCurrent();
    setTrack(null);
    trackRef.current = null;
    setIsPlaying(false);
    isPlayingRef.current = false;
    setPositionSec(0);
    setDurationSec(0);
    positionRef.current = 0;
    durationRef.current = 0;
  }, [unloadCurrent, savePlaybackProgress]);

  // Mirror track-player progress into state + refs and drive the
  // in_progress -> reflecting transition. Replaces the expo-av status callback.
  const progress = useProgress(PROGRESS_UPDATE_INTERVAL_MS);
  useEffect(() => {
    if (!hasTrackRef.current) return;
    const pos = progress.position;
    const dur = progress.duration;
    setPositionSec(pos);
    setDurationSec(dur);
    positionRef.current = pos;
    durationRef.current = dur;

    const activeTrack = trackRef.current;
    if (
      activeTrack?.source.status === SourceDTOStatus.in_progress &&
      dur > 0 &&
      pos / dur >= PLAYBACK_COMPLETE_PROGRESS
    ) {
      transitionSourceStatus(activeTrack.source, SourceDTOStatus.reflecting, () =>
        sourcesApi.reflect(activeTrack.source.id)
      );
    }
  }, [progress.position, progress.duration, transitionSourceStatus]);

  // Mirror play/pause state into state + ref. Replaces the isPlaying field of
  // the expo-av status callback.
  const { playing } = useIsPlaying();
  useEffect(() => {
    if (playing === undefined) return;
    setIsPlaying(playing);
    isPlayingRef.current = playing;
  }, [playing]);

  // didJustFinish equivalent: the queue reached its end. Save final progress
  // (not playing) and reflect the stopped state.
  useTrackPlayerEvents([Event.PlaybackQueueEnded, Event.PlaybackState], (event) => {
    if (event.type === Event.PlaybackQueueEnded) {
      const activeTrack = trackRef.current;
      if (activeTrack) {
        savePlaybackProgress(activeTrack.source.id, positionRef.current, durationRef.current, false);
      }
      setIsPlaying(false);
      isPlayingRef.current = false;
      return;
    }
    if (event.type === Event.PlaybackState && event.state === State.Ended) {
      setIsPlaying(false);
      isPlayingRef.current = false;
    }
  });

  // Save every 10s while playing
  useEffect(() => {
    const interval = setInterval(() => {
      if (trackRef.current && isPlayingRef.current && positionRef.current > 0) {
        savePlaybackProgress(trackRef.current.source.id, positionRef.current, durationRef.current, true);
      }
    }, SAVE_INTERVAL_SEC * 1000);
    return () => clearInterval(interval);
  }, [savePlaybackProgress]);

  // Flush progress when app backgrounds/inactivates so we don't lose up to 10s on app kill.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active" && trackRef.current && positionRef.current > 0) {
        savePlaybackProgress(
          trackRef.current.source.id,
          positionRef.current,
          durationRef.current,
          isPlayingRef.current,
        );
      }
    });
    return () => sub.remove();
  }, [savePlaybackProgress]);

  useEffect(() => () => { void TrackPlayer.reset(); }, []);

  return (
    <PlayerContext.Provider
      value={{
        track, isPlaying, positionSec, durationSec, isLoading, rate, isCarMode,
        play, pause, resume, togglePlayPause, seekTo, skipBack, skipForward, setRate, setCarMode, dismiss,
      }}
    >
      {children}
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error("usePlayer must be used within PlayerProvider");
  return ctx;
}

// Load local transcript synchronously (called before play()).
// Keyed by sourceId now that the offline cache is source-scoped.
export function readLocalTranscript(sourceId: number): TranscriptData | null {
  return fsReadLocalTranscript(sourceId);
}
