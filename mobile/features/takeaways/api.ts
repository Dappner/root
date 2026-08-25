import { listRecentTakeawaysRagApiTakeawaysRecentGet } from "@/lib/api/rag-generated";
import type { TakeawayResponse } from "./types";

export const takeawaysApi = {
  listRecent: async (limit: number, offset: number): Promise<TakeawayResponse[]> => {
    const response = await listRecentTakeawaysRagApiTakeawaysRecentGet({ limit, offset });
    if (response.status !== 200) {
      throw new Error(`Failed to load recent takeaways: ${response.status}`);
    }
    return response.data;
  },
};
