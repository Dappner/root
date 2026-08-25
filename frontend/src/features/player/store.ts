"use client";

import { create } from "zustand";
import type { TranscriptUtterance } from "@/features/podcasts/types";

export type PlayerMode = "collapsed" | "expanded" | "closed";

export interface ActiveSource {
  id: number;
  title: string;
  subtitle?: string;
  imageUrl?: string;
  mediaUrl: string;
  episodeId?: number;
  /** Seconds to resume from when the source is first loaded. */
  resumeAt?: number;
}

interface PlayerState {
  // Identity
  activeSource: ActiveSource | null;

  // Transport — driven by the audio element via setters
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  isReady: boolean;
  playbackRate: number;
  volume: number;

  // Desired-state pulses (incremented to signal the audio element)
  playPulse: number;
  pausePulse: number;
  seekTarget: number | null;

  // UI
  mode: PlayerMode;

  // Transcript sync (used by the source transcript page)
  utterances: TranscriptUtterance[];

  // Actions
  loadSource: (source: ActiveSource) => void;
  clearSource: () => void;

  play: () => void;
  pause: () => void;
  toggle: () => void;
  seek: (time: number) => void;
  skip: (delta: number) => void;
  setPlaybackRate: (rate: number) => void;
  setVolume: (v: number) => void;

  setMode: (mode: PlayerMode) => void;
  expand: () => void;
  collapse: () => void;
  close: () => void;

  setUtterances: (utterances: TranscriptUtterance[]) => void;

  // Reporters (called from the audio element)
  reportTime: (t: number) => void;
  reportDuration: (d: number) => void;
  reportPlaying: (playing: boolean) => void;
  reportReady: (ready: boolean) => void;
  consumeSeek: () => void;
}

const PLAYBACK_RATE_KEY = "podcast-playback-rate";

function readStoredRate(): number {
  if (typeof window === "undefined") return 1;
  const raw = window.localStorage.getItem(PLAYBACK_RATE_KEY);
  if (!raw) return 1;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function persistRate(rate: number) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PLAYBACK_RATE_KEY, String(rate));
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  activeSource: null,

  currentTime: 0,
  duration: 0,
  isPlaying: false,
  isReady: false,
  playbackRate: readStoredRate(),
  volume: 1,

  playPulse: 0,
  pausePulse: 0,
  seekTarget: null,

  mode: "closed",
  utterances: [],

  loadSource: (source) => {
    const current = get().activeSource;
    if (current?.id === source.id && current.mediaUrl === source.mediaUrl) {
      // Same source — just refresh metadata in case title/image changed.
      set({ activeSource: source });
      return;
    }
    set({
      activeSource: source,
      currentTime: source.resumeAt ?? 0,
      duration: 0,
      isPlaying: false,
      isReady: false,
      seekTarget: null,
      mode: "collapsed",
      utterances: [],
    });
  },

  clearSource: () => set({
    activeSource: null,
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    isReady: false,
    mode: "closed",
    utterances: [],
  }),

  play: () => set((s) => ({ playPulse: s.playPulse + 1 })),
  pause: () => set((s) => ({ pausePulse: s.pausePulse + 1 })),
  toggle: () => {
    const { isPlaying } = get();
    if (isPlaying) set((s) => ({ pausePulse: s.pausePulse + 1 }));
    else set((s) => ({ playPulse: s.playPulse + 1 }));
  },

  seek: (time) => set({ seekTarget: time }),
  skip: (delta) => {
    const { currentTime, duration } = get();
    const next = Math.max(0, Math.min(currentTime + delta, duration || Number.POSITIVE_INFINITY));
    set({ seekTarget: next });
  },

  setPlaybackRate: (rate) => {
    persistRate(rate);
    set({ playbackRate: rate });
  },
  setVolume: (v) => set({ volume: v }),

  setMode: (mode) => set({ mode }),
  expand: () => set((s) => (s.activeSource ? { mode: "expanded" } : s)),
  collapse: () => set((s) => (s.activeSource ? { mode: "collapsed" } : s)),
  close: () => set((s) => ({ ...s, mode: "closed", isPlaying: false, pausePulse: s.pausePulse + 1 })),

  setUtterances: (utterances) => set({ utterances }),

  reportTime: (t) => set({ currentTime: t }),
  reportDuration: (d) => set({ duration: d }),
  reportPlaying: (playing) => set({ isPlaying: playing }),
  reportReady: (ready) => set({ isReady: ready }),
  consumeSeek: () => set({ seekTarget: null }),
}));

export const useActiveSource = () => usePlayerStore((s) => s.activeSource);
