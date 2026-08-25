import {
  getMyStats,
  getUserStats,
} from "@/features/rag/rag-api.generated";
import type { UserStats } from "./types";

export const statsApi = {
  getMine: async (weeksBack?: number): Promise<UserStats> => {
    const response = await getMyStats(
      weeksBack !== undefined ? { weeks_back: weeksBack } : undefined,
    );
    if (response.status !== 200) {
      throw new Error(`Failed to fetch my stats: ${response.status}`);
    }
    return response.data;
  },

  getForUser: async (userId: string, weeksBack?: number): Promise<UserStats> => {
    const response = await getUserStats(
      userId,
      weeksBack !== undefined ? { weeks_back: weeksBack } : undefined,
    );
    if (response.status !== 200) {
      throw new Error(`Failed to fetch user stats: ${response.status}`);
    }
    return response.data;
  },
};
