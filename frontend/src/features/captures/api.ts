import {
  deleteCapture,
  listCapturesBySource,
  createCapture,
  updateCapture,
} from "@/features/rag/rag-api.generated";

import type {
  CreateCaptureResponse,
  StructuredCreateCaptureRequest,
  UpdateCaptureRequest,
} from "./types";

export const capturesApi = {
  createCapture: async (
    data: StructuredCreateCaptureRequest & { section_id?: number | null },
  ) => {
    const { section_id, citation_id, ...rest } = data;
    const payload: StructuredCreateCaptureRequest = {
      ...rest,
      citation_id,
      // Only include section_id when no citation is provided (captures with citations inherit location)
      ...(citation_id == null && section_id !== undefined
        ? { section_id }
        : {}),
    };

    const response = await createCapture(payload);
    if (response.status !== 201) {
      throw new Error(`Failed to create capture: ${response.status}`);
    }
    return response.data as CreateCaptureResponse;
  },

  updateCapture: async (
    id: number,
    data: UpdateCaptureRequest,
  ) => {
    // Only include source_id and citation_id if they're actually provided
    const cleanedData: UpdateCaptureRequest = {
      text: data.text,
      ...(data.summary !== undefined && { summary: data.summary }),
      ...(data.source_id !== undefined && { source_id: data.source_id }),
      ...(data.citation_id !== undefined && { citation_id: data.citation_id }),
    };

    const response = await updateCapture(id, cleanedData);
    if (response.status !== 200) {
      throw new Error(`Failed to update capture: ${response.status}`);
    }
    return response.data;
  },

  deleteCapture: async (id: number): Promise<void> => {
    const response = await deleteCapture(id);
    if (response.status !== 204) {
      throw new Error(`Failed to delete capture: ${response.status}`);
    }
  },

  getBySource: async (sourceId: number) => {
    const response = await listCapturesBySource(sourceId);
    if (response.status !== 200) {
      throw new Error(`Failed to get captures: ${response.status}`);
    }
    return response.data;
  },
};
