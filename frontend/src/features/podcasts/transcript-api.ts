"use client";

import {
  backfillCitationSections,
  backfillSourceSections,
  embedTranscriptRagApiTranscriptEpisodeIdEmbedPost,
  generateTranscriptRagApiTranscriptGeneratePost,
  getEpisodeAudioUrlRagApiTranscriptEpisodeIdAudioUrlGet,
  getTranscriptContentRagApiTranscriptEpisodeIdContentGet,
  getTranscriptStatusRagApiTranscriptEpisodeIdGet,
} from "@/features/rag/rag-api.generated";

import type {
  BackfillCitationSectionsResponse,
  BackfillSectionsRequest,
  BackfillSectionsResponse,
  GenerateTranscriptRequest,
  GenerateTranscriptResponse,
  TranscriptData,
} from "./types";

export const transcriptApi = {
  async generate(request: GenerateTranscriptRequest): Promise<GenerateTranscriptResponse> {
    const response = await generateTranscriptRagApiTranscriptGeneratePost(request);
    if (response.status !== 200) {
      throw new Error(`Failed to generate transcript: ${response.status}`);
    }
    return response.data;
  },

  async getStatus(episodeId: number): Promise<GenerateTranscriptResponse> {
    const response = await getTranscriptStatusRagApiTranscriptEpisodeIdGet(episodeId);
    if (response.status !== 200) {
      throw new Error(`Failed to get transcript status: ${response.status}`);
    }
    return response.data;
  },

  async getAudioUrl(episodeId: number): Promise<{ url: string | null }> {
    const response = await getEpisodeAudioUrlRagApiTranscriptEpisodeIdAudioUrlGet(episodeId);
    if (response.status !== 200) {
      throw new Error(`Failed to get audio URL: ${response.status}`);
    }
    return response.data as { url: string | null };
  },

  async embed(episodeId: number): Promise<GenerateTranscriptResponse> {
    const response = await embedTranscriptRagApiTranscriptEpisodeIdEmbedPost(episodeId);
    if (response.status !== 200) {
      throw new Error(`Failed to trigger embedding: ${response.status}`);
    }
    return response.data;
  },

  async getContent(episodeId: number): Promise<TranscriptData> {
    const response = await getTranscriptContentRagApiTranscriptEpisodeIdContentGet(episodeId);
    if (response.status !== 200) {
      throw new Error(`Failed to get transcript content: ${response.status}`);
    }
    return response.data;
  },

  async backfillSections(request: BackfillSectionsRequest): Promise<BackfillSectionsResponse> {
    const response = await backfillSourceSections(request);
    if (response.status !== 200) {
      throw new Error(`Failed to backfill sections: ${response.status}`);
    }
    return response.data;
  },

  async backfillCitationSections(): Promise<BackfillCitationSectionsResponse> {
    const response = await backfillCitationSections();
    if (response.status !== 200) {
      throw new Error(`Failed to backfill citation sections: ${response.status}`);
    }
    return response.data;
  },
};
