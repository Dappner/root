import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { Alert } from "react-native";
import { RegenerateSectionsResponseStatus } from "@/lib/api/rag-generated";
import { sourcesApi, type UpdateSourceRequestStatus } from "./api";
import { sourcesKeys } from "./query-keys";

const SECTION_REGEN_POLL_DELAYS_MS = [5_000, 15_000, 35_000] as const;

export function useUpdateSourceStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: number; status: UpdateSourceRequestStatus }) =>
      sourcesApi.updateStatus(id, status),
    onSuccess: (updated) => {
      queryClient.setQueryData(
        sourcesKeys.list(),
        (old: Awaited<ReturnType<typeof sourcesApi.listSources>> | undefined) =>
          old?.map((s) => (s.id === updated.id ? updated : s)),
      );
      queryClient.setQueryData(sourcesKeys.detail(updated.id), updated);
    },
  });
}

export function useRegenerateSections() {
  const queryClient = useQueryClient();
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Polling fallback for an LLM background task — no realtime channel,
  // so clear timers on unmount to avoid invalidating after the sheet closes.
  useEffect(() => {
    return () => {
      for (const id of timersRef.current) clearTimeout(id);
      timersRef.current = [];
    };
  }, []);

  return useMutation({
    mutationFn: (sourceId: number) => sourcesApi.regenerateSections(sourceId),
    onSuccess: (result, sourceId) => {
      if (result.status === RegenerateSectionsResponseStatus.queued) {
        const refetch = () =>
          queryClient.invalidateQueries({ queryKey: sourcesKeys.sections(sourceId) });
        for (const delay of SECTION_REGEN_POLL_DELAYS_MS) {
          timersRef.current.push(setTimeout(refetch, delay));
        }
        Alert.alert("Regenerating sections", "New sections will appear in a moment.");
      } else {
        Alert.alert("Can't regenerate yet", result.reason ?? "Transcript isn't ready.");
      }
    },
    onError: () => {
      Alert.alert("Failed to regenerate sections", "Please try again.");
    },
  });
}
