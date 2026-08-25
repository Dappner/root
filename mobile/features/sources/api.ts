import {
  listSources,
  getSource,
  updateSource,
  listSourceSections,
  listCitationsBySource,
  listCapturesBySource,
  listTakeawaysRagApiSourcesSourceIdTakeawaysGet,
  regenerateSourceSections,
  transitionSourceStatus,
} from "@/lib/api/rag-generated";
// Sections are read-only on mobile; the rag client is now the single source.
import type { SourceSectionResponse as SourceSectionDTO } from "@/lib/api/rag-generated";
import type { TransitionSourceStatusRequestStatus } from "@/lib/api/rag-generated";
import type {
  CaptureDTO,
  CitationResponse as CitationDTO,
  RegenerateSectionsResponse,
  SourceDTO,
  TakeawayWithLinksResponse,
  UpdateSourceRequest,
} from "@/lib/api/rag-generated";

// The rag client inlines the update-status enum on `UpdateSourceRequest`
// rather than emitting a named type (as the Go client did).
export type UpdateSourceRequestStatus = UpdateSourceRequest["status"];

// Renamed for parity with prior consumers that imported SourceTakeawayDTO from this module.
export type SourceTakeawayDTO = TakeawayWithLinksResponse;

export type { SourceDTO, SourceSectionDTO, CitationDTO, CaptureDTO };

export const sourcesApi = {
  listSources: async (): Promise<SourceDTO[]> => {
    const response = await listSources();
    if (response.status !== 200) throw new Error(`Failed to load sources: ${response.status}`);
    return response.data.sources ?? [];
  },

  getSource: async (id: number): Promise<SourceDTO> => {
    const response = await getSource(id);
    if (response.status !== 200) throw new Error(`Failed to load source: ${response.status}`);
    return response.data;
  },

  getSections: async (sourceId: number): Promise<SourceSectionDTO[]> => {
    const response = await listSourceSections(sourceId);
    if (response.status !== 200) throw new Error(`Failed to load sections: ${response.status}`);
    return response.data;
  },

  getCitations: async (sourceId: number): Promise<CitationDTO[]> => {
    const response = await listCitationsBySource(sourceId);
    if (response.status !== 200) throw new Error(`Failed to load citations: ${response.status}`);
    return response.data;
  },

  getCaptures: async (sourceId: number): Promise<CaptureDTO[]> => {
    const response = await listCapturesBySource(sourceId);
    if (response.status !== 200) throw new Error(`Failed to load captures: ${response.status}`);
    return response.data;
  },

  getTakeaways: async (sourceId: number): Promise<SourceTakeawayDTO[]> => {
    const response = await listTakeawaysRagApiSourcesSourceIdTakeawaysGet(sourceId);
    if (response.status !== 200) throw new Error(`Failed to load takeaways: ${response.status}`);
    return response.data;
  },

  updateStatus: async (id: number, status: UpdateSourceRequestStatus): Promise<SourceDTO> => {
    const response = await updateSource(id, { status });
    if (response.status !== 200) throw new Error(`Failed to update source: ${response.status}`);
    return response.data;
  },

  transitionStatus: async (
    id: number,
    status: TransitionSourceStatusRequestStatus,
  ): Promise<void> => {
    const response = await transitionSourceStatus(id, { status });
    if (response.status !== 200) {
      throw new Error(`Failed to transition source to ${status}: ${response.status}`);
    }
  },

  start: async (id: number): Promise<void> => {
    await sourcesApi.transitionStatus(id, "in_progress");
  },

  reflect: async (id: number): Promise<void> => {
    await sourcesApi.transitionStatus(id, "reflecting");
  },

  regenerateSections: async (id: number): Promise<RegenerateSectionsResponse> => {
    const response = await regenerateSourceSections(id);
    if (response.status !== 200) {
      throw new Error(`Failed to regenerate sections: ${response.status}`);
    }
    return response.data;
  },
};
