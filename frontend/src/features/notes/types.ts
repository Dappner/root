import type {
  CreateNoteRequest as GeneratedCreateNoteRequest,
  CreateNoteRequestKind,
  NoteDTO as GeneratedNoteDTO,
  NoteListDTO as GeneratedNoteListDTO,
  UpdateNoteRequest as GeneratedUpdateNoteRequest,
} from "@/features/rag/rag-api.generated";

export type NoteKind = CreateNoteRequestKind;

export interface NoteDTO extends Omit<GeneratedNoteDTO, "source_id" | "citation_ids"> {
  source_id?: number;
  citation_ids: number[];
}

export interface NoteListDTO extends Omit<GeneratedNoteListDTO, "source_id"> {
  source_id?: number;
}

export interface CreateNoteRequest extends Omit<GeneratedCreateNoteRequest, "source_id"> {
  source_id?: number;
}

export interface UpdateNoteRequest extends Omit<GeneratedUpdateNoteRequest, "source_id" | "kind"> {
  source_id?: number;
  kind?: NoteKind;
}
