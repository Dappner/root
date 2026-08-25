import {
  addPodcastEpisodeToLibrary,
  listPodcastShows,
  getPodcastShow,
  listPodcastEpisodes,
  getTranscriptStatusRagApiTranscriptEpisodeIdGet,
  getTranscriptContentRagApiTranscriptEpisodeIdContentGet,
} from "@/lib/api/rag-generated";
import type { SourceDTO } from "@/lib/api/rag-generated";
import type {
  AddToLibraryRequest,
  GenerateTranscriptResponse,
  PaginatedEpisodeResponse,
  PaginatedShowResponse,
  ShowDTO,
  TranscriptData,
} from "./types";

export const podcastsApi = {
  listShows: async (limit = 50, offset = 0): Promise<PaginatedShowResponse> => {
    const response = await listPodcastShows({ limit, offset });
    if (response.status !== 200) throw new Error(`Failed to list shows: ${response.status}`);
    return response.data;
  },

  getShow: async (id: string): Promise<ShowDTO> => {
    const response = await getPodcastShow(id);
    if (response.status !== 200) throw new Error(`Failed to get show: ${response.status}`);
    return response.data;
  },

  listEpisodes: async (id: string, limit = 50, offset = 0): Promise<PaginatedEpisodeResponse> => {
    const response = await listPodcastEpisodes(id, { limit, offset });
    if (response.status !== 200) throw new Error(`Failed to list episodes: ${response.status}`);
    return response.data;
  },

  addToLibrary: async (data: AddToLibraryRequest): Promise<SourceDTO> => {
    const response = await addPodcastEpisodeToLibrary(data);
    if (response.status !== 200) throw new Error(`Failed to add to library: ${response.status}`);
    return response.data;
  },

  getTranscriptStatus: async (episodeId: number): Promise<GenerateTranscriptResponse> => {
    const response = await getTranscriptStatusRagApiTranscriptEpisodeIdGet(episodeId);
    if (response.status !== 200) throw new Error(`Failed to get transcript status: ${response.status}`);
    return response.data;
  },

  getTranscriptContent: async (episodeId: number): Promise<TranscriptData> => {
    const response = await getTranscriptContentRagApiTranscriptEpisodeIdContentGet(episodeId);
    if (response.status !== 200) throw new Error(`Failed to get transcript: ${response.status}`);
    return response.data;
  },
};
