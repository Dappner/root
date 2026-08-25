import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { NoteDetailView } from "@/features/notes/components/note-detail-view";

export const Route = createFileRoute(
  "/_authenticated/library/$itemId/notes/$noteId",
)({
  params: {
    parse: (p) => ({
      itemId: z.coerce.number().parse(p.itemId),
      noteId: z.coerce.number().parse(p.noteId),
    }),
  },
  component: SourceNoteDetailRoute,
});

function SourceNoteDetailRoute() {
  const { itemId, noteId } = Route.useParams();

  return <NoteDetailView mode="source" sourceId={itemId} noteId={noteId} />;
}
