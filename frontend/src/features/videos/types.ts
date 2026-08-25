// ============================================================================
// API Type Re-exports
// ============================================================================
// All video types are served by fast-api; re-export them from the rag client.

export type {
  AddVideoToLibraryRequest,
  ImportVideoRequest,
  VideoDTO,
} from "@/features/rag/rag-api.generated";

export type {
  GenerateTranscriptResponse,
  GenerateVideoTranscriptRequest,
  TranscriptData,
  TranscriptSpeaker,
  TranscriptUtterance,
} from "@/features/rag/rag-api.generated";
