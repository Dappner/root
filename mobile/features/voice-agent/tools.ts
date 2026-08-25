import { podcastsApi } from "@/features/podcasts/api";
import type { PodcastEpisodeDTO, ShowDTO } from "@/features/podcasts/types";
import { readLocalTranscript } from "@/features/player/context";
import type { PlayerTrack } from "@/features/player/context";
import { sourcesApi } from "@/features/sources/api";
import { getSourcePlaybackPosition } from "@/lib/utils";
import type { SourceDTO } from "@/lib/api/rag-generated";

interface ListPodcastEpisodesParams {
  podcast_id?: unknown;
  podcast_slug?: unknown;
}

interface PlayPodcastEpisodeParams {
  episode_id?: unknown;
  podcast_slug?: unknown;
}

type VoiceAgentToolResult = string | number | void;
type VoiceAgentTools = Record<
  string,
  (params: Record<string, unknown>) => Promise<VoiceAgentToolResult> | VoiceAgentToolResult
>;

interface CreateVoiceAgentToolsOptions {
  play: (track: PlayerTrack, initialPositionSec?: number) => Promise<void>;
  onPlaybackStarted?: () => void;
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function numericId(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return Math.floor(value);
  if (typeof value === "string" && value.trim()) {
    const n = Number(value);
    if (Number.isFinite(n)) return Math.floor(n);
  }
  return null;
}

function truncate(value: string, max: number): string {
  const trimmed = value.replace(/\s+/g, " ").trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1).trimEnd()}…`;
}

function formatShows(shows: ShowDTO[]): string {
  if (shows.length === 0) return "No podcasts in library.";

  return shows
    .map((show, index) => {
      const author = show.author ? ` by ${show.author}` : "";
      const description = show.description ? ` — ${truncate(show.description, 160)}` : "";
      return `${index + 1}. ${show.title}${author} (podcast_id: ${show.id}, podcast_slug: ${show.slug})${description}`;
    })
    .join("\n");
}

function formatEpisodes(show: ShowDTO, episodes: PodcastEpisodeDTO[]): string {
  if (episodes.length === 0) return `No episodes found for ${show.title}.`;

  return episodes
    .map((episode, index) => {
      const published = episode.published_at ? `, published: ${episode.published_at.slice(0, 10)}` : "";
      const description = episode.description ? ` — ${truncate(episode.description, 160)}` : "";
      return `${index + 1}. ${episode.title} (episode_id: ${episode.id}, podcast_slug: ${show.slug}${published})${description}`;
    })
    .join("\n");
}

async function findShow(params: ListPodcastEpisodesParams): Promise<ShowDTO | null> {
  const slug = text(params.podcast_slug);
  if (slug) return podcastsApi.getShow(slug);

  const podcastId = numericId(params.podcast_id);
  if (podcastId == null) return null;

  const shows = await podcastsApi.listShows(50, 0);
  return (shows.data ?? []).find((show) => show.id === podcastId) ?? null;
}

async function findEpisode(
  episodeId: number,
  podcastSlug: string
): Promise<PodcastEpisodeDTO | null> {
  if (!podcastSlug) return null;

  const episodes = await podcastsApi.listEpisodes(podcastSlug, 20, 0);
  return (episodes.data ?? []).find((episode) => episode.id === episodeId) ?? null;
}

function findSourceForEpisode(sources: SourceDTO[], episodeId: number): SourceDTO | null {
  return sources.find((source) => source.type === "podcast" && source.episode_id === episodeId) ?? null;
}

export function createVoiceAgentTools({
  play,
  onPlaybackStarted,
}: CreateVoiceAgentToolsOptions): VoiceAgentTools {
  return {
    list_podcasts: async () => {
      const shows = await podcastsApi.listShows(50, 0);
      return formatShows(shows.data ?? []);
    },

    list_podcast_episodes: async (params: ListPodcastEpisodesParams) => {
      const show = await findShow(params);
      if (!show) return "Podcast not found. Call list_podcasts first and pass podcast_slug.";

      const episodes = await podcastsApi.listEpisodes(show.slug, 20, 0);
      return formatEpisodes(show, episodes.data ?? []);
    },

    play_podcast_episode: async (params: PlayPodcastEpisodeParams) => {
      const episodeId = numericId(params.episode_id);
      if (episodeId == null) return "episode_id is required.";

      const podcastSlug = text(params.podcast_slug);
      const episode = await findEpisode(episodeId, podcastSlug);
      if (!episode) {
        return "Episode not found. Call list_podcast_episodes first and pass both episode_id and podcast_slug.";
      }

      const existingSource = findSourceForEpisode(await sourcesApi.listSources(), episodeId);
      const source = existingSource ?? await podcastsApi.addToLibrary({ episode_id: episodeId });
      const transcript = readLocalTranscript(source.id);
      const { posSec } = getSourcePlaybackPosition(source.metadata);

      await play({ episode, source, transcript }, posSec > 0 ? posSec : undefined);
      onPlaybackStarted?.();
      return `Playing ${episode.title}.`;
    },
  };
}
