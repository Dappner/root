import {
  createTakeawayRagApiSourcesSourceIdTakeawaysPost as apiCreateTakeaway,
  deleteTakeawayRagApiSourcesSourceIdTakeawaysTakeawayIdDelete as apiDeleteTakeaway,
  getTakeawayParallelsRagApiTakeawaysTakeawayIdParallelsGet as apiGetTakeawayParallels,
  getTakeawayRagApiSourcesSourceIdTakeawaysTakeawayIdGet as apiGetTakeaway,
  listTakeawaysRagApiSourcesSourceIdTakeawaysGet as apiListTakeaways,
  updateTakeawayRagApiSourcesSourceIdTakeawaysTakeawayIdPut as apiUpdateTakeaway,
} from "@/features/rag/rag-api.generated";

import type {
  CreateSourceTakeawayRequest,
  UpdateSourceTakeawayRequest,
} from "./types";

export const takeawaysApi = {
  getTakeaways: async (sourceId: number) => {
    const response = await apiListTakeaways(sourceId);
    if (response.status !== 200) {
      throw new Error(`Failed to get takeaways: ${response.status}`);
    }
    return response.data;
  },

  getTakeaway: async (sourceId: number, takeawayId: number) => {
    const response = await apiGetTakeaway(sourceId, takeawayId);
    if (response.status !== 200) {
      throw new Error(`Failed to get takeaway: ${response.status}`);
    }
    return response.data;
  },

  createTakeaway: async (
    sourceId: number,
    data: CreateSourceTakeawayRequest,
  ) => {
    const response = await apiCreateTakeaway(sourceId, data);
    if (response.status !== 201) {
      throw new Error(`Failed to create takeaway: ${response.status}`);
    }
    return response.data;
  },

  updateTakeaway: async (
    sourceId: number,
    takeawayId: number,
    data: UpdateSourceTakeawayRequest,
  ) => {
    const response = await apiUpdateTakeaway(sourceId, takeawayId, data);
    if (response.status !== 200) {
      throw new Error(`Failed to update takeaway: ${response.status}`);
    }
    return response.data;
  },

  deleteTakeaway: async (
    sourceId: number,
    takeawayId: number,
  ): Promise<void> => {
    const response = await apiDeleteTakeaway(sourceId, takeawayId);
    if (response.status !== 204) {
      throw new Error(`Failed to delete takeaway: ${response.status}`);
    }
  },

  getParallels: async (takeawayId: number) => {
    const response = await apiGetTakeawayParallels(takeawayId);
    if (response.status !== 200) {
      throw new Error(`Failed to get parallels: ${response.status}`);
    }
    return response.data;
  },
};
