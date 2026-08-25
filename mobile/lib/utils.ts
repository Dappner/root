import type { SourceDTO } from "@/features/sources/api";
import { SourceDTOStatus } from "@/lib/api/rag-generated";

export function isReflectingOrDone(source: SourceDTO): boolean {
  return source.status === SourceDTOStatus.reflecting || source.status === SourceDTOStatus.done;
}

export function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const diffDays = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export const PLAYBACK_COMPLETE_PROGRESS = 0.95;

export function formatTimestamp(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// Playback-shaped subset of source.metadata. Go SourceDTO still types this loosely,
// so we accept either shape and runtime-narrow on `type`.
interface PlaybackMetadataShape {
  type?: string;
  current_position?: number | null;
  duration?: number | null;
  completed?: boolean | null;
  last_listened_at?: string | null;
  last_watched_at?: string | null;
}

export function getSourcePlaybackPosition(
  metadata: PlaybackMetadataShape | Record<string, unknown> | null | undefined,
): {
  posSec: number;
  durSec: number;
  progress: number | null;
  lastListenedAt: string | null;
} {
  const m = metadata as PlaybackMetadataShape | null | undefined;
  if (!m) return { posSec: 0, durSec: 0, progress: null, lastListenedAt: null };
  // Only podcast/video carry playback fields; book/pdf/article have no resume notion.
  if (m.type && m.type !== "podcast" && m.type !== "video") {
    return { posSec: 0, durSec: 0, progress: null, lastListenedAt: null };
  }
  const posSec = m.current_position ?? 0;
  const durSec = m.duration ?? 0;
  const progress = posSec > 0 && durSec > 0 ? Math.min(1, posSec / durSec) : null;
  const lastListenedAt = m.last_listened_at ?? m.last_watched_at ?? null;
  return { posSec, durSec, progress, lastListenedAt };
}
