import {
  createCitationRagApiCitationsPost as ragCreateCitation,
  updateCitationRagApiCitationsCitationIdPatch as ragUpdateCitation,
  deleteCitationRagApiCitationsCitationIdDelete as ragDeleteCitation,
  listCitationsRagApiCitationsGet as ragListCitations,
  type CreateCitationRequest as RagCreateCitationRequest,
  type UpdateCitationRequest as RagUpdateCitationRequest,
  listCitationsBySource,
  assignHighlight,
  listSourceSections as ragListSourceSections,
  regenerateSourceSections as ragRegenerateSourceSections,
  type RegenerateSectionsResponse,
  transitionSourceStatus,
  type TransitionSourceStatusRequestStatus,
  type SourceStatusResponse,
  updateSourceSummaries,
  deleteSource,
  listSources,
  getSource,
  createSource,
  enrichSource,
  updateSource,
  deleteSection,
  updateSection,
  createSection,
  reorderSections,
  type SourceSectionResponse as RagSourceSectionResponse,
  uploadSourcePdf,
  getSourcePdfUrl,
} from "@/features/rag/rag-api.generated";
import {
  addPodcastEpisodeToLibrary,
  importApplePodcast,
  listPodcastShows,
  getPodcastShow,
  listPodcastEpisodes,
  syncPodcastShow,
} from "@/features/rag/rag-api.generated";

export { enrichSource };

import type {
  CaptureDTO,
  CitationDTO,
  CreateCitationRequest,
  CreateCitationResponse,
  CreateSourceRequest,
  CreateSourceSectionRequest,
  MoveHighlightToSectionRequest,
  SourceDTO,
  SourceSectionDTO,
  SourcesListResponse,
  UpdateCitationRequest,
  PodcastImportRequest,
  UpdateSourceRequest,
  UpdateSourceSectionRequest,
  UpdateSourceSummariesRequest,
  AddToLibraryRequest,
  ShowDTO,
} from "./types";

export const podcastsApi = {
  getShow: async (id: string) => {
    const response = await getPodcastShow(id);
    if (response.status !== 200) {
      throw new Error(`Failed to get show: ${response.status}`);
    }
    return response.data;
  },

  listShows: async (limit?: number, offset?: number) => {
    const response = await listPodcastShows({ limit, offset });
    if (response.status !== 200) {
      throw new Error(`Failed to list shows: ${response.status}`);
    }
    // Return full paginated response: { data: ShowDTO[], pagination: Meta }
    return response.data;
  },

  listEpisodes: async (id: string, limit?: number, offset?: number) => {
    const response = await listPodcastEpisodes(id, { limit, offset });
    if (response.status !== 200) {
      throw new Error(`Failed to list episodes: ${response.status}`);
    }
    // Return full paginated response: { data: PodcastEpisodeDTO[], pagination: Meta }
    return response.data;
  },

  syncShow: async (id: string) => {
    const response = await syncPodcastShow(id);
    if (response.status !== 202) {
      throw new Error(`Failed to sync show: ${response.status}`);
    }
    return response.data;
  },

  addToLibrary: async (data: AddToLibraryRequest) => {
    const response = await addPodcastEpisodeToLibrary(data);
    if (response.status !== 200) {
      throw new Error(`Failed to add episode to library: ${response.status}`);
    }
    return response.data;
  },
};

export const sourcesApi = {
  getSources: async (): Promise<SourcesListResponse> => {
    const response = await listSources();
    if (response.status !== 200) {
      throw new Error(`Failed to get sources: ${response.status}`);
    }
    return response.data as SourcesListResponse;
  },

  importPodcast: async (
    data: PodcastImportRequest,
  ): Promise<ShowDTO> => {
    const response = await importApplePodcast(data);
    if (response.status !== 200) {
      throw new Error(`Failed to import podcast: ${response.status}`);
    }
    return response.data;
  },

  getSource: async (id: number): Promise<SourceDTO> => {
    const response = await getSource(id);
    if (response.status !== 200) {
      throw new Error(`Failed to get source: ${response.status}`);
    }
    return response.data as SourceDTO;
  },

  createSource: async (data: CreateSourceRequest): Promise<SourceDTO> => {
    const response = await createSource(data);
    if (response.status !== 201) {
      throw new Error(`Failed to create source: ${response.status}`);
    }
    return response.data as SourceDTO;
  },

  updateSource: async (id: number, data: UpdateSourceRequest): Promise<SourceDTO> => {
    const response = await updateSource(id, data);
    if (response.status !== 200) {
      throw new Error(`Failed to update source: ${response.status}`);
    }
    return response.data as SourceDTO;
  },

  deleteSource: async (id: number) => {
    const response = await deleteSource(id);
    if (response.status !== 204) {
      throw new Error(`Failed to delete source: ${response.status}`);
    }
  },

  updateSourceSummaries: async (
    id: number,
    data: UpdateSourceSummariesRequest,
  ) => {
    const response = await updateSourceSummaries(id, data);
    if (response.status !== 200) {
      throw new Error(`Failed to update source summaries: ${response.status}`);
    }
    return response.data;
  },

  transitionStatus: async (
    id: number,
    status: TransitionSourceStatusRequestStatus,
  ): Promise<SourceStatusResponse> => {
    const response = await transitionSourceStatus(id, { status });
    if (response.status !== 200) {
      throw new Error(`Failed to transition source to ${status}: ${response.status}`);
    }
    return response.data;
  },
};

export const pdfApi = {
  uploadPdf: async (sourceId: number, file: File) => {
    const response = await uploadSourcePdf(sourceId, { file });
    if (response.status !== 200) {
      throw new Error(`Failed to upload PDF: ${response.status}`);
    }
    return response.data;
  },

  getPdfUrl: async (sourceId: number) => {
    const response = await getSourcePdfUrl(sourceId);
    if (response.status !== 200) {
      throw new Error(`Failed to load PDF URL: ${response.status}`);
    }
    return response.data;
  },
};

export const sectionsApi = {
  getSections: async (sourceId: number): Promise<SourceSectionDTO[]> => {
    const response = await ragListSourceSections(sourceId);
    if (response.status !== 200) {
      throw new Error(`Failed to get sections: ${response.status}`);
    }
    return response.data;
  },

  createSection: async (
    sourceId: number,
    data: CreateSourceSectionRequest,
  ): Promise<SourceSectionDTO> => {
    const response = await createSection(sourceId, data);
    if (response.status !== 201) {
      throw new Error(`Failed to create section: ${response.status}`);
    }
    return response.data;
  },

  updateSection: async (
    sourceId: number,
    id: number,
    data: UpdateSourceSectionRequest,
  ): Promise<SourceSectionDTO> => {
    const response = await updateSection(
      sourceId,
      id,
      data,
    );
    if (response.status !== 200) {
      throw new Error(`Failed to update section: ${response.status}`);
    }
    return response.data;
  },

  deleteSection: async (sourceId: number, id: number): Promise<void> => {
    const response = await deleteSection(sourceId, id);
    if (response.status !== 204) {
      throw new Error(`Failed to delete section: ${response.status}`);
    }
  },

  reorderSections: async (
    sourceId: number,
    sectionIds: number[],
  ): Promise<void> => {
    const response = await reorderSections(sourceId, {
      section_ids: sectionIds,
    });

    if (response.status !== 204) {
      throw new Error(`Failed to reorder sections: ${response.status}`);
    }
  },

  // fast-api collapsed Go's reorder-siblings into the single reorder endpoint
  // (membership-only validation, partial sets allowed), so both facade methods
  // call the same rag `reorderSections`.
  reorderSiblings: async (
    sourceId: number,
    sectionIds: number[],
  ): Promise<void> => {
    const response = await reorderSections(sourceId, {
      section_ids: sectionIds,
    });

    if (response.status !== 204) {
      throw new Error(`Failed to reorder siblings: ${response.status}`);
    }
  },

  moveHighlight: async (
    sourceId: number,
    payload: MoveHighlightToSectionRequest,
  ): Promise<void> => {
    const response = await assignHighlight(
      sourceId,
      payload,
    );
    if (response.status !== 204) {
      throw new Error(`Failed to move highlight: ${response.status}`);
    }
  },

  regenerateSections: async (
    sourceId: number,
  ): Promise<RegenerateSectionsResponse> => {
    const response = await ragRegenerateSourceSections(sourceId);
    if (response.status !== 200) {
      throw new Error(`Failed to regenerate sections: ${response.status}`);
    }
    return response.data;
  },
};

// Optional response fields are already `T?` from OpenAPI normalization, so
// citation and capture responses are consumed directly. The only facade difference is
// `CitationDTO.location` (relabelled to the hand-written `CitationLocation`) and
// the client-side `takeaways` enrichment — both structural, so a cast at the
// boundary suffices.
export const citationsApi = {
  getCitations: async (): Promise<CitationDTO[]> => {
    const response = await ragListCitations();
    if (response.status !== 200) {
      throw new Error(`Failed to get citations: ${response.status}`);
    }
    return response.data as CitationDTO[];
  },

  getCitationsBySource: async (sourceId: number): Promise<CitationDTO[]> => {
    const response = await listCitationsBySource(sourceId);
    if (response.status !== 200) {
      throw new Error(`Failed to get citations: ${response.status}`);
    }
    return response.data as CitationDTO[];
  },

  createCitation: async (data: CreateCitationRequest): Promise<CreateCitationResponse> => {
    const response = await ragCreateCitation(data as RagCreateCitationRequest);
    if (response.status !== 201) {
      throw new Error(`Failed to create citation: ${response.status}`);
    }
    const { citation, captures, source_started } = response.data;
    return {
      citation: citation as CitationDTO,
      captures: (captures ?? []) as CaptureDTO[],
      source_started,
    };
  },

  createCitationFromSuggestion: async (
    data: RagCreateCitationRequest,
  ): Promise<CreateCitationResponse> => {
    const response = await ragCreateCitation(data);
    if (response.status !== 201) {
      throw new Error(`Failed to create citation: ${response.status}`);
    }
    const { citation, captures, source_started } = response.data;
    return {
      citation: citation as CitationDTO,
      captures: (captures ?? []) as CaptureDTO[],
      source_started,
    };
  },

  updateCitation: async (id: number, data: UpdateCitationRequest): Promise<CitationDTO> => {
    const response = await ragUpdateCitation(id, data as RagUpdateCitationRequest);
    if (response.status !== 200) {
      throw new Error(`Failed to update citation: ${response.status}`);
    }
    return response.data as CitationDTO;
  },

  deleteCitation: async (id: number): Promise<void> => {
    const response = await ragDeleteCitation(id);
    if (response.status !== 204) {
      throw new Error(`Failed to delete citation: ${response.status}`);
    }
  },
};
