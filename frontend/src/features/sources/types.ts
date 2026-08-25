export type {
  CreateSourceRequest,
  CreateSourceRequestStatus as SourceStatus,
  EnrichSourceResponse,
  UpdateSourceRequest,
} from "@/features/rag/rag-api.generated";

export type {
  CreateSourceSectionRequest,
  UpdateSourceSectionRequest,
} from "@/features/rag/rag-api.generated";

export type {
  AddToLibraryRequest,
  ShowDTO,
  PodcastEpisodeDTO,
  PaginatedShowResponse,
  PaginatedEpisodeResponse,
  PodcastImportRequest,
  UpdateSourceSummariesRequest,
} from "@/features/rag/rag-api.generated";

export type {
  CaptureDTO,
  MoveHighlightToSectionRequest,
  PdfPosition,
  PdfRect,
} from "@/features/rag/rag-api.generated";

export type SectionGeneratedBy = "user" | "auto";

export { SourceDTOStatus } from "@/features/rag/rag-api.generated";

export type SourceType = "book" | "article" | "video" | "podcast" | "pdf";

// Optional response fields are already `T?` in the FastAPI OpenAPI schema, so
// the generated `SourceDTO` is consumed directly. The one remaining override is
// `metadata`: the generated type is the typed `SourceMetadata` discriminated
// union, but the rest of the frontend treats it as a loose record (defensive
// `as Record<...>` casts, JSON-string fallbacks). Loosen just that field here.
import type {
  SourceDTO as ApiSourceDTO,
  SourcesListResponse as ApiSourcesListResponse,
} from "@/features/rag/rag-api.generated";

export interface SourceDTO extends Omit<ApiSourceDTO, "metadata"> {
  metadata?: Record<string, unknown>;
}

export interface SourcesListResponse
  extends Omit<ApiSourcesListResponse, "sources"> {
  sources: SourceDTO[];
}

// Citation create/update/delete + capture-input live on fast-api; bring those
// types in from its generated client.
import type {
  CitationResponse as ApiCitationDTO,
  CreateCaptureInput,
  CreateCitationRequest as ApiCreateCitationRequest,
  CreateCitationResponse as ApiCreateCitationResponse,
  RegenerateSectionsResponse,
  SourceSectionResponse as ApiSourceSectionDTO,
  UpdateCitationRequest as ApiUpdateCitationRequest,
} from "@/features/rag/rag-api.generated";
export { RegenerateSectionsResponseStatus } from "@/features/rag/rag-api.generated";

export type { CreateCaptureInput, RegenerateSectionsResponse };

// Sections are fully served by fast-api (reads + writes). Optional response
// fields are already `T?` from OpenAPI normalization, and the generated
// `SourceSectionResponse` carries `generated_by`, so it's re-exported directly.
export type SourceSectionDTO = ApiSourceSectionDTO;
import type { CaptureDTO } from "@/features/rag/rag-api.generated";

import type { SourceTakeawayDTO } from "@/features/takeaways/types";
import type { CitationLocation } from "@/features/sources/utils/location";

// `location` is the one citation field still overridden: the generated type is
// the union of generated location payloads, but the frontend consumes the
// hand-written `CitationLocation`. All other optional response fields are
// already `T?` from OpenAPI normalization.
//
// CitationDTO enriched with takeaways (added client-side).
export interface CitationDTO extends Omit<ApiCitationDTO, "location"> {
  location?: CitationLocation;
  takeaways?: SourceTakeawayDTO[];
}

// Create payloads never send `null` to clear (that's a PATCH concern), so the
// preserved `| null` on this request schema is narrowed back to a clean optional
// shape here, plus the `location` type substitution.
export interface CreateCitationRequest
  extends Omit<
    ApiCreateCitationRequest,
    "location" | "source_id" | "section_id" | "summary" | "speaker" | "context" | "suggestion_id"
  > {
  location?: CitationLocation;
  source_id?: number;
  section_id?: number;
  summary?: string;
  speaker?: string;
  context?: string;
  suggestion_id?: number;
}

// PATCH payload: `null` clears the field, `undefined` preserves it (omitted).
// Keep this distinction — `CitationFieldOverrides` would collapse `null` into
// `undefined`, which would prevent clearing nullable fields.
export interface UpdateCitationRequest
  extends Omit<
    ApiUpdateCitationRequest,
    "location" | "source_id" | "section_id" | "summary" | "speaker" | "context"
  > {
  location?: CitationLocation | null;
  source_id?: number | null;
  section_id?: number | null;
  summary?: string | null;
  speaker?: string | null;
  context?: string | null;
}

export interface CreateCitationResponse extends Omit<ApiCreateCitationResponse, "citation" | "captures"> {
  citation: CitationDTO;
  captures: CaptureDTO[];
}

export interface CitationWithCapture {
  citation: CitationDTO;
  captures: CaptureDTO[];
}

export interface GroupedSection {
  section: SourceSectionDTO;
  citations: CitationWithCapture[];
  captures: CaptureDTO[];
}

export interface UnsortedHighlights {
  citations: CitationWithCapture[];
  captures: CaptureDTO[];
}

export interface GroupedHighlights {
  sections: GroupedSection[];
  unsorted: UnsortedHighlights;
  totalCount: number;
}
