import type {
  ApproveSuggestionRequest,
  ApproveSuggestionResponse,
  SuggestedCapturePayload,
  SuggestedCitationPayloadInput,
  SuggestedCitationPayloadOutput,
  SuggestedPayloadEntitiesInput,
  SuggestedPayloadEntitiesOutput,
  SuggestedPayloadUncertain,
  SuggestionResponse,
  TranscriptLocation,
  TranscriptV1Location,
} from "@/features/rag/rag-api.generated";

import type { SourceDTO } from "@/features/sources/types";

export type {
  ApproveSuggestionRequest,
  ApproveSuggestionResponse,
  SuggestedCapturePayload,
  SuggestedCitationPayloadInput,
  SuggestedCitationPayloadOutput,
  SuggestedPayloadEntitiesInput,
  SuggestedPayloadEntitiesOutput,
  SuggestedPayloadUncertain,
  SuggestionResponse,
  TranscriptLocation,
  TranscriptV1Location,
};

export type SuggestionPayload =
  | SuggestedPayloadEntitiesOutput
  | SuggestedPayloadUncertain;

export interface SuggestionWithSource extends SuggestionResponse {
  source?: Pick<SourceDTO, "id" | "title" | "type" | "image_url">;
}
