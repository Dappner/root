"use client";

import { NotesBrowser } from "@/features/notes/components/notes-browser";
import { useCreateSourceNote, useSourceNotes } from "@/features/notes/hooks";
import { routes } from "@/lib/routes";
import { useRouter } from "@/lib/nav";

interface SourceNotesPageProps {
  sourceId: number;
}

export function SourceNotesPage({ sourceId }: SourceNotesPageProps) {
  const router = useRouter();
  const { data: notes = [], isLoading } = useSourceNotes(sourceId);
  const createNote = useCreateSourceNote(sourceId);

  const handleNew = async () => {
    const note = await createNote.mutateAsync({
      title: "",
      kind: "note",
      body: { type: "doc", content: [] },
      citation_ids: [],
    });
    router.push(routes.sourceNote(sourceId, note.id));
  };

  return (
    <NotesBrowser
      notes={notes}
      isLoading={isLoading}
      onCreate={handleNew}
      isCreatePending={createNote.isPending}
      createLabel="New Note"
      emptyMessage="No notes for this source yet. Create the first one."
      getNoteHref={(note) => routes.sourceNote(sourceId, note.id)}
    />
  );
}
