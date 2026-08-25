export const STORAGE_LIMIT_BYTES = 10 * 1024 * 1024 * 1024;

export type DownloadQuality = "standard" | "balanced" | "best";

export const qualityLabels: Record<DownloadQuality, string> = {
  standard: "Standard (smaller)",
  balanced: "Balanced (medium)",
  best: "Best available",
};

export const downloadQualityOptions: DownloadQuality[] = ["standard", "balanced", "best"];

export function formatDuration(seconds: number | null | undefined) {
  if (!seconds) return null;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function formatBytes(bytes: number) {
  if (bytes >= 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  }
  if (bytes >= 1024 * 1024) {
    return `${Math.max(0.1, bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function initialsFor(name?: string | null) {
  if (!name) return "?";
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
