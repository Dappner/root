import { useQuery } from "@tanstack/react-query";
import { getNote, listNotes, listNotesBySource } from "@/lib/api/rag-generated";
import { notesKeys } from "./query-keys";

const NOTES_STALE_TIME_MS = 2 * 60 * 1000;

export function useNotes() {
  return useQuery({
    queryKey: notesKeys.list(),
    queryFn: async () => {
      const res = await listNotes();
      if (res.status !== 200) throw new Error("Failed to load notes");
      return res.data;
    },
    staleTime: NOTES_STALE_TIME_MS,
  });
}

export function useNote(id: number | null) {
  return useQuery({
    queryKey: notesKeys.detail(id ?? 0),
    queryFn: async () => {
      const res = await getNote(id!);
      if (res.status !== 200) throw new Error("Failed to load note");
      return res.data;
    },
    enabled: !!id,
    staleTime: NOTES_STALE_TIME_MS,
  });
}

export function useNotesBySource(sourceId: number | null) {
  return useQuery({
    queryKey: notesKeys.bySource(sourceId ?? 0),
    queryFn: async () => {
      const res = await listNotesBySource(sourceId!);
      if (res.status !== 200) throw new Error("Failed to load notes");
      return res.data;
    },
    enabled: !!sourceId,
    staleTime: NOTES_STALE_TIME_MS,
  });
}
