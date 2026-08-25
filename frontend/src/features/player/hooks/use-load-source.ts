"use client";

import { useCallback } from "react";
import { usePlayerStore, type ActiveSource } from "@/features/player/store";
import type { SourceDTO } from "@/features/sources/types";

function getSavedPosition(source: SourceDTO): number {
  const metadata = source.metadata;
  if (!metadata) return 0;
  let parsed: Record<string, unknown> = {};
  if (typeof metadata === "string") {
    try { parsed = JSON.parse(metadata); } catch { return 0; }
  } else if (typeof metadata === "object") {
    parsed = metadata as Record<string, unknown>;
  }
  const position = parsed.current_position;
  return typeof position === "number" ? position : 0;
}

function toActiveSource(source: SourceDTO): ActiveSource | null {
  if (source.type !== "podcast" || !source.media_url) return null;
  return {
    id: source.id,
    title: source.title ?? "Untitled",
    subtitle: source.author ?? undefined,
    imageUrl: source.image_url ?? undefined,
    mediaUrl: source.media_url,
    episodeId: source.episode_id ?? undefined,
    resumeAt: getSavedPosition(source),
  };
}

/**
 * Imperative controls for the global player, scoped to a specific source.
 *
 * Visiting a source page does NOT load it into the global player — playback is
 * opt-in via these actions (header Play button, transcript timestamp click, etc.).
 *
 * - `isActive` — whether this source is currently loaded in the global player.
 * - `isPlaying` — whether this source is loaded AND playing.
 * - `playOrToggle()` — load if not active and start playing; otherwise toggle play/pause.
 * - `loadAndSeek(seconds)` — load (if not active) and seek to the given time without
 *   auto-playing. If already active, just seeks.
 */
export function usePlayerControl(source: SourceDTO | null | undefined) {
  const activeId = usePlayerStore((s) => s.activeSource?.id);
  const isPlaying = usePlayerStore((s) => s.isPlaying);

  const isActive = !!source && activeId === source.id;

  const playOrToggle = useCallback(() => {
    if (!source) return;
    const next = toActiveSource(source);
    if (!next) return;
    const store = usePlayerStore.getState();
    if (store.activeSource?.id === source.id) {
      // Resurfacing a closed dock counts as opening — show it expanded so the
      // user gets full controls. Otherwise just toggle play/pause without
      // disturbing the existing collapsed/expanded mode.
      if (store.mode === "closed") store.expand();
      store.toggle();
      return;
    }
    store.loadSource(next);
    store.expand();
    store.play();
  }, [source]);

  const loadAndSeek = useCallback(
    (seconds: number) => {
      if (!source) return;
      const store = usePlayerStore.getState();
      if (store.activeSource?.id !== source.id) {
        const next = toActiveSource(source);
        if (!next) return;
        store.loadSource({ ...next, resumeAt: seconds });
        return;
      }
      store.seek(seconds);
    },
    [source],
  );

  return {
    isActive,
    isPlaying: isActive && isPlaying,
    playOrToggle,
    loadAndSeek,
  };
}
