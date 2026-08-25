import { Directory, File } from "expo-file-system";
import type { SourceDTO } from "@/lib/api/rag-generated";
import type { PodcastEpisodeDTO, ShowDTO } from "@/features/podcasts/types";
import type { TranscriptData } from "@/lib/api/rag-generated";
import { writePodcastMeta } from "./podcasts";
import {
  coverFile,
  getSourceDirectory,
  getSourcesRootDirectory,
  metaFile,
  resolveAudioFilename,
  transcriptFile,
} from "./paths";
import type { SourceMeta } from "./meta-types";

export interface DownloadSourceInput {
  source: SourceDTO;
  episode?: PodcastEpisodeDTO;
  podcast?: ShowDTO;
  transcript?: TranscriptData | null;
  audioUrl?: string | null;
  imageUrl?: string | null;
}

export function readSourceMeta(sourceId: number): SourceMeta | null {
  try {
    const file = metaFile(sourceId);
    if (!file.exists) return null;
    return JSON.parse(file.textSync()) as SourceMeta;
  } catch {
    return null;
  }
}

export function writeSourceMeta(sourceId: number, meta: SourceMeta): void {
  const file = metaFile(sourceId);
  file.create({ intermediates: true, overwrite: true });
  file.write(JSON.stringify(meta, null, 2));
}

export function readLocalTranscript(sourceId: number): TranscriptData | null {
  try {
    const file = transcriptFile(sourceId);
    if (!file.exists) return null;
    return JSON.parse(file.textSync()) as TranscriptData;
  } catch {
    return null;
  }
}

export function writeLocalTranscript(sourceId: number, transcript: TranscriptData): void {
  const file = transcriptFile(sourceId);
  file.create({ intermediates: true, overwrite: true });
  file.write(JSON.stringify(transcript));
}

export function resolveLocalAudioUri(sourceId: number): string | null {
  const meta = readSourceMeta(sourceId);
  if (!meta?.audio_file) return null;
  const file = new File(getSourceDirectory(sourceId), meta.audio_file);
  return file.exists ? file.uri : null;
}

export function hasDownloadedAudio(sourceId: number): boolean {
  return resolveLocalAudioUri(sourceId) !== null;
}

export async function downloadSource(input: DownloadSourceInput): Promise<void> {
  const { source, episode, transcript } = input;
  const sourceId = source.id;
  const dir = getSourceDirectory(sourceId);
  dir.create({ intermediates: true, idempotent: true });

  const audioUrl = input.audioUrl ?? episode?.enclosure_url ?? source.media_url ?? null;
  const audioFilename = audioUrl ? resolveAudioFilename(audioUrl) : undefined;

  const meta: SourceMeta = {
    schema: 1,
    downloaded_at: new Date().toISOString(),
    audio_file: audioFilename,
    podcast_id: input.podcast?.id,
    source,
    episode,
  };
  writeSourceMeta(sourceId, meta);

  const imageUrl = input.imageUrl ?? source.image_url ?? episode?.image_url ?? null;
  if (imageUrl) {
    try {
      await File.downloadFileAsync(imageUrl, coverFile(sourceId), { idempotent: true });
    } catch {}
  }

  if (audioUrl && audioFilename) {
    await File.downloadFileAsync(audioUrl, new File(dir, audioFilename), { idempotent: true });
  }

  if (transcript) {
    writeLocalTranscript(sourceId, transcript);
  }

  if (input.podcast) {
    writePodcastMeta({
      schema: 1,
      downloaded_at: new Date().toISOString(),
      podcast_id: input.podcast.id,
      slug: input.podcast.slug,
      title: input.podcast.title,
      author: input.podcast.author ?? undefined,
      description: input.podcast.description ?? undefined,
      image_url: input.podcast.image_url ?? undefined,
    });
  }
}

export function deleteSourceDownload(sourceId: number): void {
  const dir = getSourceDirectory(sourceId);
  if (!dir.exists) return;

  const meta = readSourceMeta(sourceId);
  const audio = meta?.audio_file ? new File(dir, meta.audio_file) : null;
  if (audio?.exists) audio.delete();
  const cov = coverFile(sourceId);
  if (cov.exists) cov.delete();
  const tr = transcriptFile(sourceId);
  if (tr.exists) tr.delete();

  // Preserve pending/ subdir — voice notes captured offline must survive
  // a "delete download" action.
  const pending = new Directory(dir, "pending");
  if (!pending.exists) {
    dir.delete();
    return;
  }
  const mf = metaFile(sourceId);
  if (mf.exists) mf.delete();
}

export function listDownloadedSources(): SourceMeta[] {
  const root = getSourcesRootDirectory();
  if (!root.exists) return [];

  const results: SourceMeta[] = [];
  for (const entry of root.list()) {
    try {
      const sourceId = Number(entry.name);
      if (!Number.isFinite(sourceId)) continue;
      const meta = readSourceMeta(sourceId);
      if (!meta) continue;
      // Only count as "downloaded" if audio is actually on disk.
      // A source dir may exist purely to hold a pending voice note.
      if (!meta.audio_file) continue;
      const audio = new File(getSourceDirectory(sourceId), meta.audio_file);
      if (!audio.exists) continue;
      results.push(meta);
    } catch {}
  }
  results.sort(
    (a, b) => new Date(b.downloaded_at).getTime() - new Date(a.downloaded_at).getTime()
  );
  return results;
}

export function getDownloadedSourcesStorageBytes(): number {
  return listDownloadedSources().reduce((total, meta) => {
    const sourceId = meta.source.id;
    const dir = getSourceDirectory(sourceId);
    const files = [
      metaFile(sourceId),
      coverFile(sourceId),
      transcriptFile(sourceId),
      meta.audio_file ? new File(dir, meta.audio_file) : null,
    ];

    return total + files.reduce((sum, file) => {
      if (!file?.exists) return sum;
      try {
        return sum + file.size;
      } catch {
        return sum;
      }
    }, 0);
  }, 0);
}

export function isSourceDownloaded(sourceId: number): boolean {
  const meta = readSourceMeta(sourceId);
  if (!meta?.audio_file) return false;
  return new File(getSourceDirectory(sourceId), meta.audio_file).exists;
}
