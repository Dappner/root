import type { AskRequest, ModelConfig } from "@/lib/api/rag-generated";

export type { AskRequest, ModelConfig };

export interface RagCitation {
  type: "citation" | "capture" | "takeaway" | "source_section_summary" | "transcript_chunk";
  entity_id: number;
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
  text?: string;
  score?: number;
}

export interface AskResponse {
  answer: string;
  citations?: Record<string, RagCitation>;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  citations?: Record<string, RagCitation>;
}

export interface CitationReference {
  token: string;
  citation: RagCitation;
}

export type DeltaPayload = {
  text: string;
  citations?: Record<string, RagCitation>;
  seq?: number;
};

export type DonePayload = {
  citations?: Record<string, RagCitation>;
  seq?: number;
};

export type ResumeAckPayload = {
  replayed: number;
  from_seq: number;
};

export type StreamHandlers = {
  onAnswerDelta?: (payload: DeltaPayload) => void;
  onFinal?: (payload: DonePayload) => void;
  onError?: (error: Error) => void;
  onSeq?: (seq: number) => void;
  onResumeAck?: (payload: ResumeAckPayload) => void;
};
