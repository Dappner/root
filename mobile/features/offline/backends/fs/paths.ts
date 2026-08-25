import { Directory, File, Paths } from "expo-file-system";

const AUDIO_EXTENSIONS = ["m4a", "mp3", "aac", "mp4", "ogg"] as const;

export function getSourcesRootDirectory(): Directory {
  return new Directory(Paths.document, "sources");
}

export function getSourceDirectory(sourceId: number): Directory {
  return new Directory(Paths.document, "sources", String(sourceId));
}

export function getPodcastsRootDirectory(): Directory {
  return new Directory(Paths.document, "podcasts");
}

export function getPodcastDirectory(podcastId: number): Directory {
  return new Directory(Paths.document, "podcasts", String(podcastId));
}

export function getPendingDirectory(sourceId: number): Directory {
  return new Directory(getSourceDirectory(sourceId), "pending");
}

export function metaFile(sourceId: number): File {
  return new File(getSourceDirectory(sourceId), "meta.json");
}

export function podcastMetaFile(podcastId: number): File {
  return new File(getPodcastDirectory(podcastId), "meta.json");
}

export function transcriptFile(sourceId: number): File {
  return new File(getSourceDirectory(sourceId), "transcript.json");
}

export function coverFile(sourceId: number): File {
  return new File(getSourceDirectory(sourceId), "cover.jpg");
}

export function resolveAudioFilename(url: string | null | undefined): string {
  if (!url) return "audio.mp3";
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    const dot = pathname.lastIndexOf(".");
    if (dot === -1) return "audio.mp3";
    const ext = pathname.slice(dot + 1);
    return (AUDIO_EXTENSIONS as readonly string[]).includes(ext) ? `audio.${ext}` : "audio.mp3";
  } catch {
    return "audio.mp3";
  }
}
