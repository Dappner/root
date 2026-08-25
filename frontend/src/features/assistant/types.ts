export type AssistantSurface =
  | "ask"
  | "library"
  | "source"
  | "section"
  | "citation"
  | "note"
  | "takeaways"
  | "review";

export interface RootAssistantContext {
  surface: AssistantSurface;
  source_id?: number;
  section_id?: number;
  citation_id?: number;
  note_id?: number;
  takeaway_id?: number;
}
