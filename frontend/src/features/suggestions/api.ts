import {
  approveSuggestionRagApiSuggestionsSuggestionIdApprovePost,
  createVoiceSuggestionRagApiSuggestionsVoicePost,
  dismissSuggestionRagApiSuggestionsSuggestionIdDismissPost,
  getSuggestionRagApiSuggestionsSuggestionIdGet,
  listSourceSuggestionsRagApiSourcesSourceIdSuggestionsGet,
  retrySuggestionRagApiSuggestionsSuggestionIdRetryPost,
} from "@/features/rag/rag-api.generated";
import { customFetch } from "@/lib/fetchers/api-fetcher";

import type {
  ApproveSuggestionRequest,
  ApproveSuggestionResponse,
  SuggestionResponse,
} from "./types";

export interface CreateVoiceSuggestionInput {
  file: Blob;
  filename: string;
  clientId: string;
  sourceId: number;
  episodeId?: number | null;
  playbackPositionSeconds?: number | null;
  recordedAt?: string | null;
}

export const suggestionsApi = {
  createVoiceSuggestion: async (input: CreateVoiceSuggestionInput): Promise<SuggestionResponse> => {
    const file = new File([input.file], input.filename, { type: input.file.type || "audio/webm" });
    const response = await createVoiceSuggestionRagApiSuggestionsVoicePost({
      file,
      client_id: input.clientId,
      source_id: input.sourceId,
      episode_id: input.episodeId ?? undefined,
      playback_position_seconds: input.playbackPositionSeconds ?? undefined,
      recorded_at: input.recordedAt ?? undefined,
    });
    if (response.status !== 200) {
      throw new Error(`Failed to create voice suggestion: ${response.status}`);
    }
    return response.data;
  },

  listSuggestions: async (params?: {
    statuses?: SuggestionResponse["status"][];
    limit?: number;
  }): Promise<SuggestionResponse[]> => {
    const searchParams = new URLSearchParams();
    if (params?.statuses?.length) {
      searchParams.set("status", params.statuses.join(","));
    }
    if (params?.limit) {
      searchParams.set("limit", String(params.limit));
    }
    const suffix = searchParams.toString();
    const response = await customFetch<{ data: { suggestions: SuggestionResponse[] }; status: number }>(
      `/rag-api/suggestions${suffix ? `?${suffix}` : ""}`,
    );
    if (response.status !== 200) {
      throw new Error(`Failed to list suggestions: ${response.status}`);
    }
    return response.data.suggestions;
  },

  listSourceSuggestions: async (sourceId: number): Promise<SuggestionResponse[]> => {
    const response = await listSourceSuggestionsRagApiSourcesSourceIdSuggestionsGet(sourceId);
    if (response.status !== 200) {
      throw new Error(`Failed to list suggestions: ${response.status}`);
    }
    return response.data.suggestions;
  },

  getSuggestion: async (suggestionId: number): Promise<SuggestionResponse> => {
    const response = await getSuggestionRagApiSuggestionsSuggestionIdGet(suggestionId);
    if (response.status !== 200) {
      throw new Error(`Failed to get suggestion: ${response.status}`);
    }
    return response.data;
  },

  approveSuggestion: async (
    suggestionId: number,
    payload: ApproveSuggestionRequest,
  ): Promise<ApproveSuggestionResponse> => {
    const response = await approveSuggestionRagApiSuggestionsSuggestionIdApprovePost(
      suggestionId,
      payload,
    );
    if (response.status !== 200) {
      throw new Error(`Failed to approve suggestion: ${response.status}`);
    }
    return response.data;
  },

  retrySuggestion: async (
    suggestionId: number,
    refinement?: string,
  ): Promise<SuggestionResponse> => {
    const response = await retrySuggestionRagApiSuggestionsSuggestionIdRetryPost(suggestionId, {
      refinement: refinement ?? null,
    });
    if (response.status !== 200) {
      throw new Error(`Failed to retry suggestion: ${response.status}`);
    }
    return response.data;
  },

  dismissSuggestion: async (suggestionId: number): Promise<SuggestionResponse> => {
    const response = await dismissSuggestionRagApiSuggestionsSuggestionIdDismissPost(suggestionId);
    if (response.status !== 200) {
      throw new Error(`Failed to dismiss suggestion: ${response.status}`);
    }
    return response.data;
  },
};
