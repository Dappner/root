"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { homeKeys } from "@/features/home/hooks";
import { notesApi } from "./api";
import { notesKeys } from "./keys";
import type { CreateNoteRequest, UpdateNoteRequest } from "./types";

export function useAllNotes() {
  return useQuery({
    queryKey: notesKeys.list("all"),
    queryFn: notesApi.listAll,
    staleTime: 30_000,
  });
}

export function useNotes() {
  return useQuery({
    queryKey: notesKeys.list("general"),
    queryFn: notesApi.listGeneral,
    staleTime: 30_000,
  });
}

export function useSourceNotes(sourceId: number) {
  return useQuery({
    queryKey: notesKeys.list({ sourceId }),
    queryFn: () => notesApi.listBySource(sourceId),
    enabled: !!sourceId,
    staleTime: 30_000,
  });
}

export function useNote(id: number) {
  return useQuery({
    queryKey: notesKeys.detail(id),
    queryFn: () => notesApi.get(id),
    enabled: !!id,
    staleTime: 30_000,
  });
}

export function useCreateNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateNoteRequest) => notesApi.create(data),
    onSuccess: (note) => {
      // Seed detail cache immediately so the editor page has data on first render
      queryClient.setQueryData(notesKeys.detail(note.id), note);
      queryClient.invalidateQueries({ queryKey: notesKeys.list("general") });
      queryClient.invalidateQueries({ queryKey: homeKeys.all });
    },
  });
}

export function useCreateSourceNote(sourceId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Omit<CreateNoteRequest, "source_id">) =>
      notesApi.createForSource(sourceId, data),
    onSuccess: (note) => {
      queryClient.setQueryData(notesKeys.detail(note.id), note);
      queryClient.invalidateQueries({ queryKey: notesKeys.list({ sourceId }) });
      queryClient.invalidateQueries({ queryKey: homeKeys.all });
    },
  });
}

export function useUpdateNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      data,
      expectedUpdatedAt,
    }: {
      id: number;
      data: UpdateNoteRequest;
      expectedUpdatedAt?: string;
    }) => notesApi.update(id, data, { expectedUpdatedAt }),
    onSuccess: (note) => {
      queryClient.setQueryData(notesKeys.detail(note.id), note);
      const listKey = note.source_id
        ? notesKeys.list({ sourceId: note.source_id })
        : notesKeys.list("general");
      queryClient.invalidateQueries({ queryKey: listKey });
      queryClient.invalidateQueries({ queryKey: homeKeys.all });
    },
  });
}

export function useDeleteNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => notesApi.delete(id),
    onSuccess: (_, id) => {
      queryClient.removeQueries({ queryKey: notesKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: notesKeys.lists() });
      queryClient.invalidateQueries({ queryKey: homeKeys.all });
    },
  });
}
