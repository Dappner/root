import { createFileRoute } from "@tanstack/react-router";

import { NotesPage } from "@/features/notes/pages/notes-page";

export const Route = createFileRoute("/_authenticated/notes/")({
  component: NotesPage,
});
