import { useQuery } from "@tanstack/react-query";
import { graphApi } from "@/features/graph/api";
import { graphKeys } from "@/features/graph/keys";

export function useGraph() {
  return useQuery({
    queryKey: graphKeys.full(),
    queryFn: graphApi.getGraph,
    // The graph is a "show me the whole picture" view; it can lag a bit
    // behind writes without harm. Refresh on focus (default) handles
    // returning to the tab after writing elsewhere.
    staleTime: 60 * 1000,
  });
}

export function useNeighborhood(nodeId: string) {
  return useQuery({
    queryKey: graphKeys.neighborhood(nodeId),
    queryFn: () => graphApi.getNeighborhood(nodeId),
    // Same staleness logic as the full graph — structural neighborhood
    // changes only on citation/note/takeaway edits.
    staleTime: 60 * 1000,
  });
}
