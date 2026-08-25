import { useMemo } from "react";
import { useSources } from "@/features/sources/hooks";
import type { SourceDTO } from "@/features/sources/api";
import {
  PLAYBACK_COMPLETE_PROGRESS,
  getSourcePlaybackPosition,
  isReflectingOrDone,
} from "@/lib/utils";

export interface ContinueListeningItem {
  source: SourceDTO;
  playback: ReturnType<typeof getSourcePlaybackPosition>;
}

/**
 * In-progress podcast episodes the user should resume, most-recent first.
 *
 * Shared by Home's "Continue where you left off" and the Podcasts tab's
 * "Continue" shelf so both surfaces stay in sync. An episode qualifies when it
 * is a podcast source with a saved position past the start but not yet
 * effectively complete, and the user has not moved it to reflecting/done.
 */
export function useContinueListening(limit?: number): ContinueListeningItem[] {
  const { data: sources } = useSources();

  return useMemo(() => {
    const list = (sources ?? [])
      .map((source) => ({ source, playback: getSourcePlaybackPosition(source.metadata) }))
      .filter(({ source, playback }) => {
        if (source.type !== "podcast" || !source.episode_id) return false;
        if (isReflectingOrDone(source)) return false;
        const p = playback.progress;
        return p !== null && p > 0 && p < PLAYBACK_COMPLETE_PROGRESS;
      })
      .sort((a, b) => {
        const aTime = a.playback.lastListenedAt ?? a.source.updated_at;
        const bTime = b.playback.lastListenedAt ?? b.source.updated_at;
        return new Date(bTime).getTime() - new Date(aTime).getTime();
      });
    return limit != null ? list.slice(0, limit) : list;
  }, [sources, limit]);
}

/**
 * Tier for ordering a podcast episode within the user's library list.
 * In-progress floats to the top, finished (reflecting/done) sinks to the
 * bottom, not-started sits between — each tier sorted recency-first.
 */
function episodeTier(source: SourceDTO, progress: number | null): 0 | 1 | 2 {
  if (isReflectingOrDone(source) || (progress !== null && progress >= PLAYBACK_COMPLETE_PROGRESS)) {
    return 2; // finished
  }
  if (progress !== null && progress > 0) return 0; // in progress
  return 1; // not started
}

/**
 * All of the user's podcast episodes (their owned `SourceDTO`s — not the shared
 * `ShowDTO` catalog), ordered in-progress → not-started → finished, each tier
 * most-recent first.
 */
export function useMyPodcastEpisodes(): SourceDTO[] {
  const { data: sources } = useSources();

  return useMemo(() => {
    return (sources ?? [])
      .filter((s) => s.type === "podcast" && s.episode_id != null)
      .map((source) => ({ source, playback: getSourcePlaybackPosition(source.metadata) }))
      .sort((a, b) => {
        const tierA = episodeTier(a.source, a.playback.progress);
        const tierB = episodeTier(b.source, b.playback.progress);
        if (tierA !== tierB) return tierA - tierB;
        const aTime = a.playback.lastListenedAt ?? a.source.updated_at;
        const bTime = b.playback.lastListenedAt ?? b.source.updated_at;
        return new Date(bTime).getTime() - new Date(aTime).getTime();
      })
      .map(({ source }) => source);
  }, [sources]);
}
