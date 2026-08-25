"use client";

import { capturesKeys } from "@/features/captures/keys";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { sectionsApi } from "../api";
import { citationsKeys, sourcesKeys } from "../keys";
import {
  RegenerateSectionsResponseStatus,
  type CreateSourceSectionRequest,
  type SourceSectionDTO,
  type UpdateSourceSectionRequest,
} from "../types";

const SECTION_REGEN_POLL_DELAYS_MS = [5_000, 15_000, 35_000] as const;

export function useSourceSections(sourceId: number | undefined) {
  return useQuery({
    queryKey: sourcesKeys.sections(sourceId!),
    queryFn: () => sectionsApi.getSections(sourceId!),
    enabled: sourceId !== undefined,
    select: (sections) => sortSections(sections),
  });
}

export function useCreateSection(sourceId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateSourceSectionRequest) =>
      sectionsApi.createSection(sourceId, data),
    onMutate: async (variables) => {
      const queryKey = sourcesKeys.sections(sourceId);
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<SourceSectionDTO[]>(queryKey);

      const now = new Date().toISOString();
      const currentSections = previous ?? [];
      const maxOrderIndex = currentSections.reduce(
        (max, s) => Math.max(max, s.order_index),
        -1
      );

      const optimisticSection: SourceSectionDTO = {
        id: -Date.now(),
        source_id: sourceId,
        title: variables.title,
        subtitle: variables.subtitle ?? undefined,
        summary: variables.summary ?? undefined,
        range_start: variables.range_start ?? undefined,
        range_end: variables.range_end ?? undefined,
        order_index: maxOrderIndex + 1,
        generated_by: "user",
        created_at: now,
        updated_at: now,
      };

      queryClient.setQueryData<SourceSectionDTO[]>(queryKey, (old = []) => [
        ...old,
        optimisticSection,
      ]);

      return { previous };
    },
    onError: (_error, _variables, context) => {
      queryClient.setQueryData(sourcesKeys.sections(sourceId), context?.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: sourcesKeys.sections(sourceId) });
    },
  });
}

export function useUpdateSection(sourceId: number, sectionId: number) {
  const queryClient = useQueryClient();
  const queryKey = sourcesKeys.sections(sourceId);

  return useMutation({
    mutationFn: (data: UpdateSourceSectionRequest) =>
      sectionsApi.updateSection(sourceId, sectionId, data),
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<SourceSectionDTO[]>(queryKey);

      queryClient.setQueryData<SourceSectionDTO[]>(queryKey, (old) => {
        if (!old) return old;
        return old.map((s) =>
          s.id === sectionId
            ? {
                ...s,
                title: variables.title,
                subtitle: variables.subtitle ?? undefined,
                summary: variables.summary ?? undefined,
                range_start: variables.range_start ?? undefined,
                range_end: variables.range_end ?? undefined,
                updated_at: new Date().toISOString(),
              }
            : s,
        );
      });

      return { previous };
    },
    onError: (_error, _variables, context) => {
      queryClient.setQueryData(queryKey, context?.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });
}

export function useDeleteSection(sourceId: number, sectionId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => sectionsApi.deleteSection(sourceId, sectionId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: sourcesKeys.sections(sourceId),
      });
      // Also invalidate citations and captures since they may have been reassigned
      queryClient.invalidateQueries({
        queryKey: citationsKeys.bySource(sourceId),
      });
      queryClient.invalidateQueries({
        queryKey: capturesKeys.bySource(sourceId),
      });
    },
  });
}

export function useReorderSections(sourceId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (sectionIds: number[]) =>
      sectionsApi.reorderSections(sourceId, sectionIds),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: sourcesKeys.sections(sourceId),
      });
    },
  });
}

export function useRegenerateSections() {
  const queryClient = useQueryClient();
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Polling fallback for an LLM background task — no SSE/realtime channel,
  // so clear timers on unmount to avoid invalidating after navigation.
  useEffect(() => {
    return () => {
      for (const id of timersRef.current) clearTimeout(id);
      timersRef.current = [];
    };
  }, []);

  return useMutation({
    mutationFn: (sourceId: number) => sectionsApi.regenerateSections(sourceId),
    onSuccess: (result, sourceId) => {
      if (result.status === RegenerateSectionsResponseStatus.queued) {
        const refetch = () =>
          queryClient.invalidateQueries({
            queryKey: sourcesKeys.sections(sourceId),
          });
        for (const delay of SECTION_REGEN_POLL_DELAYS_MS) {
          timersRef.current.push(setTimeout(refetch, delay));
        }
        toast.success("Regenerating sections — they'll appear in a moment.");
      } else {
        toast.message("Can't regenerate yet", {
          description: result.reason ?? "Transcript isn't ready.",
        });
      }
    },
    onError: () => toast.error("Failed to regenerate sections."),
  });
}

function sortSections(sections: SourceSectionDTO[]): SourceSectionDTO[] {
  if (!sections?.length) return [];
  return [...sections].sort((a, b) => a.order_index - b.order_index);
}
