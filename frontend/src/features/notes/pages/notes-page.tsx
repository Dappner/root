"use client";

import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { PageHeader } from "@/components/layout/page-header";
import { RightSlideover } from "@/components/layout/right-slideover";
import { NoteSlideoverPanel } from "@/features/notes/components/note-slideover-panel";
import { NotesBrowser } from "@/features/notes/components/notes-browser";
import { useCreateNote, useNotes } from "@/features/notes/hooks";
import type { NoteListDTO } from "@/features/notes/types";
import { routes } from "@/lib/routes";
import { useRouter } from "@/lib/nav";
import { useState } from "react";

const PANEL_DEFAULT_WIDTH = 560;

export function NotesPage() {
  const router = useRouter();
  const { data: notes = [], isLoading } = useNotes();
  const createNote = useCreateNote();
  const [selectedNote, setSelectedNote] = useState<NoteListDTO | null>(null);
  const [panelWidth, setPanelWidth] = useState(PANEL_DEFAULT_WIDTH);

  const handleNew = async () => {
    const note = await createNote.mutateAsync({
      title: "",
      kind: "note",
      body: { type: "doc", content: [] },
      citation_ids: [],
    });
    router.push(routes.note(note.id));
  };

  const handleClose = () => setSelectedNote(null);

  const handleNoteSelect = (note: NoteListDTO) => {
    if (window.innerWidth < 768) {
      router.push(routes.note(note.id));
    } else {
      setSelectedNote(note);
    }
  };

  return (
    <div className="flex h-screen flex-col">
      <PageHeader breadcrumbs={<Breadcrumbs items={[{ label: "Notes" }]} />} />
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 md:px-8">
        <NotesBrowser
          notes={notes}
          isLoading={isLoading}
          onCreate={handleNew}
          isCreatePending={createNote.isPending}
          emptyMessage="No notes yet. Create your first one."
          selectedNoteId={selectedNote?.id ?? null}
          onNoteSelect={handleNoteSelect}
        />
      </div>

      <RightSlideover
        open={!!selectedNote}
        width={panelWidth}
        onWidthChange={setPanelWidth}
        onClose={handleClose}
        className="hidden md:flex"
      >
        {selectedNote && (
          <NoteSlideoverPanel note={selectedNote} onClose={handleClose} />
        )}
      </RightSlideover>
    </div>
  );
}
