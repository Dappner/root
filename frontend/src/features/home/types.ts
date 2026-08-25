// ============================================================================
// API Type Re-exports
// ============================================================================
// This is the ONLY file in the home feature that imports from generated clients.

import type {
  HomeResponse as ApiHomeResponse,
  HomePrimaryItem,
  HomeNoteDTO,
  HomeRecentSource,
} from "@/features/rag/rag-api.generated";

export type {
  HomePrimaryItem,
  HomeNoteDTO,
  HomeRecentSource,
};

export interface HomeRecentHighlight {
  kind: "citation" | "capture";
  id: number;
  source_id?: number;
  source_title?: string;
  source_type?: string;
  section_id?: number;
  section_title?: string;
  text: string;
  summary?: string;
  info_type?: string;
  created_at: string;
  updated_at: string;
}

export interface HomeResponse extends ApiHomeResponse {
  recent_highlights?: HomeRecentHighlight[];
}
