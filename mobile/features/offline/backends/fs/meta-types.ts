import type { SourceDTO } from "@/lib/api/rag-generated";
import type { PodcastEpisodeDTO } from "@/features/podcasts/types";

export type SourceMetaSchema = 1;

export interface SourceMeta {
  schema: SourceMetaSchema;
  downloaded_at: string;
  audio_file?: string;
  podcast_id?: number;
  source: SourceDTO;
  episode?: PodcastEpisodeDTO;
}

export interface PodcastMeta {
  schema: SourceMetaSchema;
  downloaded_at: string;
  podcast_id: number;
  slug: string;
  title: string;
  author?: string;
  description?: string;
  image_url?: string;
}

export type PendingStatus = "pending" | "failed";

export interface PendingVoiceNote {
  client_id: string;
  source_id: number;
  episode_id?: number;
  playback_position_seconds?: number;
  recorded_at: string;
  attempts: number;
  last_error?: string;
  status: PendingStatus;
  audio_file: string;
}
