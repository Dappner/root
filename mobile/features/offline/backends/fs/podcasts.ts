import { getPodcastDirectory, getPodcastsRootDirectory, podcastMetaFile } from "./paths";
import type { PodcastMeta } from "./meta-types";

export function readPodcastMeta(podcastId: number): PodcastMeta | null {
  try {
    const file = podcastMetaFile(podcastId);
    if (!file.exists) return null;
    return JSON.parse(file.textSync()) as PodcastMeta;
  } catch {
    return null;
  }
}

export function writePodcastMeta(meta: PodcastMeta): void {
  const dir = getPodcastDirectory(meta.podcast_id);
  dir.create({ intermediates: true, idempotent: true });
  const file = podcastMetaFile(meta.podcast_id);
  file.create({ intermediates: true, overwrite: true });
  file.write(JSON.stringify(meta, null, 2));
}

export function listDownloadedPodcastMetas(): PodcastMeta[] {
  const root = getPodcastsRootDirectory();
  if (!root.exists) return [];

  const results: PodcastMeta[] = [];
  for (const entry of root.list()) {
    const podcastId = Number(entry.name);
    if (!Number.isFinite(podcastId)) continue;
    const meta = readPodcastMeta(podcastId);
    if (meta) results.push(meta);
  }
  return results;
}
