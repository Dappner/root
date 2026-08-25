import {
  getGraphRagApiGraphGet as apiGetGraph,
  getNeighborhoodRagApiNeighborhoodGet as apiGetNeighborhood,
} from "@/features/rag/rag-api.generated";

export const graphApi = {
  getGraph: async () => {
    const response = await apiGetGraph();
    if (response.status !== 200) {
      throw new Error(`Failed to get graph: ${response.status}`);
    }
    return response.data;
  },

  getNeighborhood: async (nodeId: string) => {
    const response = await apiGetNeighborhood({ node_id: nodeId });
    if (response.status !== 200) {
      throw new Error(`Failed to get neighborhood: ${response.status}`);
    }
    return response.data;
  },
};
