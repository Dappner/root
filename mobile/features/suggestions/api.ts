import {
  approveSuggestionRagApiSuggestionsSuggestionIdApprovePost,
  createVoiceSuggestionRagApiSuggestionsVoicePost,
  dismissSuggestionRagApiSuggestionsSuggestionIdDismissPost,
  listSourceSuggestionsRagApiSourcesSourceIdSuggestionsGet,
  retrySuggestionRagApiSuggestionsSuggestionIdRetryPost,
} from "@/lib/api/rag-generated";
import type {
  ApproveSuggestionRequest,
  SuggestionResponse,
} from "@/lib/api/rag-generated";

export type { SuggestionResponse };

export interface CreateVoiceSuggestionInput {
  uri: string;
  clientId: string;
  sourceId: number;
  episodeId?: number | null;
  playbackPositionSeconds?: number | null;
  recordedAt?: string | null;
}

export const suggestionsApi = {
  createVoice: async (input: CreateVoiceSuggestionInput): Promise<SuggestionResponse> => {
    const file = {
      uri: input.uri,
      name: `voice-${input.clientId}.m4a`,
      type: "audio/m4a",
    } as unknown as Blob;

    const response = await createVoiceSuggestionRagApiSuggestionsVoicePost({
      file,
      client_id: input.clientId,
      source_id: input.sourceId,
      episode_id: input.episodeId ?? undefined,
      playback_position_seconds: input.playbackPositionSeconds ?? undefined,
      recorded_at: input.recordedAt ?? undefined,
    });
    if (response.status !== 200) throw new Error(`Failed to create suggestion: ${response.status}`);
    return response.data;
  },

  listForSource: async (sourceId: number): Promise<SuggestionResponse[]> => {
    const response = await listSourceSuggestionsRagApiSourcesSourceIdSuggestionsGet(sourceId);
    if (response.status !== 200) throw new Error(`Failed to load suggestions: ${response.status}`);
    return response.data.suggestions;
  },

  approve: async (suggestionId: number, payload?: ApproveSuggestionRequest["payload"]) => {
    const response = await approveSuggestionRagApiSuggestionsSuggestionIdApprovePost(suggestionId, {
      payload: payload ?? null,
    });
    if (response.status !== 200) throw new Error(`Failed to approve suggestion: ${response.status}`);
    return response.data;
  },

  dismiss: async (suggestionId: number): Promise<SuggestionResponse> => {
    const response = await dismissSuggestionRagApiSuggestionsSuggestionIdDismissPost(suggestionId);
    if (response.status !== 200) throw new Error(`Failed to dismiss suggestion: ${response.status}`);
    return response.data;
  },

  retry: async (suggestionId: number): Promise<SuggestionResponse> => {
    const response = await retrySuggestionRagApiSuggestionsSuggestionIdRetryPost(suggestionId);
    if (response.status !== 200) throw new Error(`Failed to retry suggestion: ${response.status}`);
    return response.data;
  },
};
