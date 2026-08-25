import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { NoteDetailView } from "@/features/notes/components/note-detail-view";

export const Route = createFileRoute("/_authenticated/notes/$id")({
  params: {
    parse: (p) => ({ id: z.coerce.number().parse(p.id) }),
  },
  component: NoteDetailRoute,
});

function NoteDetailRoute() {
  const { id } = Route.useParams();

  return <NoteDetailView mode="global" noteId={id} />;
}
