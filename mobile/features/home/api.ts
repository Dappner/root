import { mobileFetch } from "@/lib/api/fetcher";
import type { HomeResponse } from "./types";

export const homeApi = {
  getHome: async (): Promise<HomeResponse> => {
    const response = await mobileFetch<{ data: HomeResponse; status: number }>(
      "/rag-api/home"
    );
    if (response.status !== 200) {
      throw new Error(`Failed to fetch home data: ${response.status}`);
    }
    return response.data;
  },
};
