// RAG API facade types.
//
// This module centralizes types consumed by the RAG feature.
// Request/filter/model shapes are derived from FastAPI OpenAPI-generated types.
// Streaming event payloads remain local because SSE event unions are not well represented in OpenAPI.

import type {
  AskRequest as AskRequestGenerated,
  CatalogModel as CatalogModelGenerated,
  ModelCatalog as ModelCatalogGenerated,
  ReflectRequest as ReflectRequestGenerated,
  ModelConfig as ModelConfigGenerated,
  ReasoningOptionValue as ReasoningOptionValueGenerated,
  RetrievalFilters as RetrievalFiltersGenerated,
} from "./rag-api.generated";

export type RetrievalFilters = RetrievalFiltersGenerated;

export type ModelConfig = Omit<
  ModelConfigGenerated,
  "provider" | "model" | "thinking_level" | "reasoning_effort"
> & {
  provider: "gemini" | "openai" | "anthropic";
  model: NonNullable<ModelConfigGenerated["model"]>;
  thinking_level?: GeminiThinkingLevel;
  reasoning_effort?: OpenAIReasoningEffort | AnthropicReasoningEffort;
};

export interface AskContext {
  surface:
    | "ask"
    | "library"
    | "source"
    | "section"
    | "citation"
    | "note"
    | "takeaways"
    | "review";
  source_id?: number;
  section_id?: number;
  citation_id?: number;
  note_id?: number;
  takeaway_id?: number;
}

export interface AskHistoryMessage {
  role: "user" | "assistant";
  content: string;
}

export type AskRequest = Omit<AskRequestGenerated, "model_config"> & {
  model_config?: ModelConfig;
  context?: AskContext;
  history?: AskHistoryMessage[];
};

export type ReflectRequest = Omit<ReflectRequestGenerated, "model_config"> & {
  model_config?: ModelConfig;
};

export type GeminiThinkingLevel = NonNullable<ModelConfigGenerated["thinking_level"]>;
export type OpenAIReasoningEffort = NonNullable<ModelConfigGenerated["reasoning_effort"]>;
export type AnthropicReasoningEffort = OpenAIReasoningEffort;
export type ReasoningLevel = ReasoningOptionValueGenerated | null;
export type AvailableModel = CatalogModelGenerated;
export type ModelCatalog = ModelCatalogGenerated;
export type AvailableModelId = string;

export type RagCitationKind =
  | "citation"
  | "capture"
  | "takeaway"
  | "source_section_summary"
  | "transcript_chunk";

export interface RagCitation {
  id: number;
  type: RagCitationKind;
  entity_id: number;
  text?: string;
  source_id?: number;
  source_title?: string;
  source_type?: string;
  source_author?: string;
  source_label?: string;
  source_status?: string;
  source_published_at?: string;
  source_last_active_at?: string;
  section_id?: number;
  section_title?: string;
  section_subtitle?: string;
  section_summary?: string;
  citation_id?: number;
  citation_text?: string;
  citation_speaker?: string;
  citation_context?: string;
  takeaway_title?: string;
  takeaway_body?: string;
  chunk_index?: number;
  chunk_start?: number;
  chunk_end?: number;
  chunk_speakers?: string[];
  score?: number;
}

export interface CitationSuggestion {
  citation_id: number;
  citation_text: string;
  source_id: number;
  source_title?: string;
  speaker?: string;
  context?: string;
  /** Probe question injected by the LLM response text — parsed on the frontend */
  probe?: string;
}

export interface AskResponse {
  answer: string;
  citations?: Record<string, RagCitation>;
}

export interface CitationReference {
  token: string;
  display: string;
  index?: number;
  ref_key?: string;
  citation: RagCitation;
  sourceId?: number;
}


// ─── Chat items (discriminated union) ────────────────────────────────────────

export type ChatItem =
  | {
      kind: "user_message";
      id: string;
      text: string;
    }
  | {
      kind: "tool_call";
      id: string;
      callId: string;
      name: string;
      args: Record<string, unknown>;
      status: "pending" | "done" | "error";
      error?: string;
      summary?: string;
      metadata?: Record<string, unknown>;
      display?: {
        label?: string;
        title?: string;
        detail?: string | null;
        summary?: string | null;
        result?: string | null;
      };
    }
  | {
      kind: "reasoning";
      id: string;
      /** Jetflow thought id — deltas for the same thought accumulate into one item. */
      thoughtId: string;
      text: string;
      /** False once the matching reasoning_done arrives. */
      streaming: boolean;
      durationMs?: number;
    }
  | {
      kind: "assistant_suggestion";
      id: string;
      suggestion: Record<string, unknown>;
    }
  | {
      kind: "assistant_message";
      id: string;
      text: string;
      citations?: Record<string, RagCitation>;
      suggestions?: CitationSuggestion[];
      followups?: string[];
    }
  | {
      kind: "streaming_answer";
      id: "live";
      text: string;
      citations?: Record<string, RagCitation>;
    };
