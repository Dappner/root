"use client";

import { capturesKeys } from "@/features/captures/keys";
import { useCapturesBySource } from "@/features/captures/hooks";
import { homeKeys } from "@/features/home/hooks";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { toast } from "sonner";
import { citationsApi } from "../api";
import { citationsKeys } from "../keys";
import type { CaptureDTO } from "@/features/captures/types";
import type {
  CitationDTO,
  CitationWithCapture,
  CreateCitationRequest,
  CreateCitationResponse,
  UpdateCitationRequest,
} from "../types";
import type { CreateCitationRequest as RagCreateCitationRequest } from "@/features/rag/rag-api.generated";

export function useCitationsBySource(sourceId: number) {
  return useQuery({
    queryKey: citationsKeys.bySource(sourceId),
    queryFn: () => citationsApi.getCitationsBySource(sourceId),
    enabled: !!sourceId,
  });
}

/**
 * Combines citations with their associated captures for a given source.
 * Useful for transcript display and other views that show citations with inline notes.
 */
export function useCitationsWithCaptures(sourceId: number) {
  const citationsQuery = useCitationsBySource(sourceId);
  const capturesQuery = useCapturesBySource(sourceId);

  const citationsWithCaptures = useMemo((): CitationWithCapture[] => {
    if (!citationsQuery.data) return [];
    return citationsQuery.data.map((citation): CitationWithCapture => {
      const captures =
        capturesQuery.data?.filter((c) => c.citation_id === citation.id) ?? [];
      return { citation, captures };
    });
  }, [citationsQuery.data, capturesQuery.data]);

  return {
    data: citationsWithCaptures,
    citations: citationsQuery.data,
    captures: capturesQuery.data,
    isLoading: citationsQuery.isLoading || capturesQuery.isLoading,
    isError: citationsQuery.isError || capturesQuery.isError,
    error: citationsQuery.error || capturesQuery.error,
  };
}

export function useCreateCitation() {
  const queryClient = useQueryClient();

  type OptimisticContext = {
    queryKey?: ReturnType<typeof citationsKeys.bySource>;
    previous?: CitationDTO[];
    capturesKey?: ReturnType<typeof capturesKeys.bySource>;
    previousCaptures?: CaptureDTO[];
  };

  return useMutation<CreateCitationResponse, Error, CreateCitationRequest, OptimisticContext>({
    mutationFn: citationsApi.createCitation,
    onMutate: async (variables: CreateCitationRequest) => {
      const sourceId = variables.source_id;
      if (!sourceId) return {};
      const now = new Date().toISOString();
      const optimisticId = -Date.now();
      const captureInputs = (variables.captures ?? []).filter((c) =>
        c.text?.trim(),
      );
      const hasCaptures = captureInputs.length > 0;

      const optimisticLocation =
        (variables.location ?? undefined) as unknown as CitationDTO["location"];

      const queryKey = citationsKeys.bySource(sourceId);
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<CitationDTO[]>(queryKey);
      const capturesKey = capturesKeys.bySource(sourceId);
      const previousCaptures = queryClient.getQueryData<CaptureDTO[]>(capturesKey);

      const optimisticCitation: CitationDTO = {
        id: optimisticId,
        info_type: variables.info_type ?? "quote",
        text: variables.text,
        source_id: sourceId,
        section_id: variables.section_id,
        location: optimisticLocation,
        speaker: variables.speaker,
        context: variables.context,
        created_at: now,
        updated_at: now,
        user_id: "optimistic",
      };

      queryClient.setQueryData<CitationDTO[]>(queryKey, (old = []) => [
        optimisticCitation,
        ...old,
      ]);

      if (hasCaptures) {
        const optimisticCaptures: CaptureDTO[] = captureInputs.map(
          (input, index) => ({
            id: optimisticId - index,
            text: input.text.trim(),
            citation_id: optimisticId,
            source_id: sourceId,
            created_at: now,
            updated_at: now,
            user_id: "optimistic",
          }),
        );
        queryClient.setQueryData<CaptureDTO[]>(capturesKey, (old = []) => [
          ...optimisticCaptures,
          ...old,
        ]);
      }

      return { queryKey, previous, capturesKey, previousCaptures };
    },
    onError: (_error, _variables, context) => {
      if (context?.queryKey) {
        queryClient.setQueryData(context.queryKey, context.previous);
      }
      if (context?.capturesKey) {
        queryClient.setQueryData(context.capturesKey, context.previousCaptures);
      }
      toast.error("Failed to save citation");
    },
    onSettled: (data) => {
      queryClient.invalidateQueries({ queryKey: citationsKeys.all });
      if (data && data.captures.length > 0) {
        queryClient.invalidateQueries({ queryKey: capturesKeys.all });
      }
      queryClient.invalidateQueries({ queryKey: homeKeys.all });
      if (data?.source_started) {
        toast.success("Moved to In progress");
      }
    },
  });
}

export function useCreateCitationFromSuggestion() {
  const queryClient = useQueryClient();

  return useMutation<CreateCitationResponse, Error, RagCreateCitationRequest>({
    mutationFn: citationsApi.createCitationFromSuggestion,
    onSettled: (data) => {
      queryClient.invalidateQueries({ queryKey: citationsKeys.all });
      if (data && data.captures.length > 0) {
        queryClient.invalidateQueries({ queryKey: capturesKeys.all });
      }
      queryClient.invalidateQueries({ queryKey: homeKeys.all });
    },
  });
}

export function useUpdateCitation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: number;
      data: UpdateCitationRequest;
      sourceId?: number | null;
    }) =>
      citationsApi.updateCitation(id, data),
    onSuccess: (citation, variables) => {
      const sourceId = variables.sourceId ?? citation.source_id ?? variables.data.source_id;
      if (!sourceId) return;

      queryClient.setQueryData<CitationDTO[]>(
        citationsKeys.bySource(sourceId),
        (old) => old?.map((item) => (item.id === citation.id ? citation : item)),
      );

      queryClient.setQueryData<CaptureDTO[]>(
        capturesKeys.bySource(sourceId),
        (old) => {
          if (!old) return old;
          const existingById = new Map(old.map((capture) => [capture.id, capture]));
          const citationCaptures = (citation.captures ?? []).map((capture) => ({
            ...existingById.get(capture.id),
            ...capture,
          }));
          const otherCaptures = old.filter((capture) => capture.citation_id !== citation.id);
          return [...otherCaptures, ...citationCaptures];
        },
      );
    },
  });
}

interface DeleteCitationVariables {
  id: number;
  sourceId?: number | null;
}

export function useDeleteCitation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id }: DeleteCitationVariables) => citationsApi.deleteCitation(id),
    onSuccess: (_data, { sourceId }) => {
      if (sourceId) {
        queryClient.invalidateQueries({ queryKey: citationsKeys.bySource(sourceId) });
      }
    },
  });
}
