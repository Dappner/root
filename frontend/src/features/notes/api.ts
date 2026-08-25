import {
  createNote,
  createNoteForSource,
  deleteNote,
  getNote,
  listNotes,
  listNotesBySource,
  updateNote,
} from "@/features/rag/rag-api.generated";

import type { CreateNoteRequest, NoteDTO, NoteListDTO, UpdateNoteRequest } from "./types";

export const notesApi = {
  listAll: async (): Promise<NoteListDTO[]> => {
    const response = await listNotes();
    if (response.status !== 200) {
      throw new Error(`Failed to list notes: ${response.status}`);
    }
    return response.data as NoteListDTO[];
  },

  listGeneral: async (): Promise<NoteListDTO[]> => {
    const notes = await notesApi.listAll();
    return notes.filter((note) => note.source_id == null);
  },

  listBySource: async (sourceId: number): Promise<NoteListDTO[]> => {
    const response = await listNotesBySource(sourceId);
    if (response.status !== 200) {
      throw new Error(`Failed to list source notes: ${response.status}`);
    }
    return response.data as NoteListDTO[];
  },

  get: async (id: number): Promise<NoteDTO> => {
    const response = await getNote(id);
    if (response.status !== 200) {
      throw new Error(`Failed to get note: ${response.status}`);
    }
    return response.data as NoteDTO;
  },

  create: async (data: CreateNoteRequest): Promise<NoteDTO> => {
    const response = await createNote(data);
    if (response.status !== 201) {
      throw new Error(`Failed to create note: ${response.status}`);
    }
    return response.data as NoteDTO;
  },

  createForSource: async (
    sourceId: number,
    data: Omit<CreateNoteRequest, "source_id">
  ): Promise<NoteDTO> => {
    const response = await createNoteForSource(sourceId, data);
    if (response.status !== 201) {
      throw new Error(`Failed to create source note: ${response.status}`);
    }
    return response.data as NoteDTO;
  },

  update: async (
    id: number,
    data: UpdateNoteRequest,
    options?: { expectedUpdatedAt?: string }
  ): Promise<NoteDTO> => {
    const headers = options?.expectedUpdatedAt
      ? { "X-Expected-Updated-At": options.expectedUpdatedAt }
      : undefined;
    const response = await updateNote(id, data, { headers });
    if (response.status !== 200) {
      throw new Error(`Failed to update note: ${response.status}`);
    }
    return response.data as NoteDTO;
  },

  delete: async (id: number): Promise<void> => {
    const response = await deleteNote(id);
    if (response.status !== 204) {
      throw new Error(`Failed to delete note: ${response.status}`);
    }
  },
};
