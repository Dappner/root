// Synthetic source node — sources aren't in GraphResponse.nodes; we build them
// client-side from the takeaways/notes already referencing them. Carries the
// fields the renderer needs without inventing a fake GraphNodeDTO shape.
export interface SourceNode {
  kind: "source";
  id: string; // "source:<id>"
  source_id: number;
  title: string;
  childCount: number; // how many takeaway/note nodes reference this source
}
