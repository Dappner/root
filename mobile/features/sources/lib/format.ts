import type { SourceDTO } from "../api";
import { getSourcePlaybackPosition } from "@/lib/utils";

export function formatRemaining(durSec: number, posSec: number): string | null {
  const remaining = Math.max(0, durSec - posSec);
  if (remaining <= 0) return null;
  const h = Math.floor(remaining / 3600);
  const m = Math.floor((remaining % 3600) / 60);
  if (h > 0) return `${h}h ${m}m left`;
  return `${m}m left`;
}

export function formatDuration(seconds: number | null | undefined): string | null {
  if (!seconds) return null;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function typeLabel(t: string | undefined): string | null {
  if (!t) return null;
  if (t === "pdf") return "PDF";
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export function formatSourceMeta(source: SourceDTO): string | null {
  const meta = (source.metadata ?? {}) as Record<string, unknown>;
  const parts: string[] = [];
  const type = source.type;
  const t = typeLabel(type);
  if (t) parts.push(t);

  switch (type) {
    case "book": {
      if (source.author) parts.push(source.author);
      const pages = typeof meta.pages === "number" ? meta.pages : null;
      if (pages) parts.push(`${pages} pages`);
      break;
    }
    case "article": {
      const publication = typeof meta.publication === "string" ? meta.publication : null;
      if (publication) parts.push(publication);
      else if (source.author) parts.push(source.author);
      if (source.published_at) {
        parts.push(new Date(source.published_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }));
      }
      break;
    }
    case "pdf": {
      if (source.author) parts.push(source.author);
      const pageCount = typeof meta.page_count === "number" ? meta.page_count : null;
      if (pageCount) parts.push(`${pageCount} pages`);
      break;
    }
    case "video": {
      const channel = typeof meta.channel === "string" ? meta.channel : null;
      if (channel) parts.push(channel);
      else if (source.author) parts.push(source.author);
      const dur = formatDuration(source.duration);
      if (dur) parts.push(dur);
      break;
    }
    case "podcast": {
      if (source.author) parts.push(source.author);
      break;
    }
    default:
      if (source.author) parts.push(source.author);
  }

  return parts.length > 0 ? parts.join(" · ") : null;
}

export function getProgress(source: SourceDTO): number | null {
  return getSourcePlaybackPosition(source.metadata).progress;
}
