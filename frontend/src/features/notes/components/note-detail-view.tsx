"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { useRouter } from "@/lib/nav";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NoteEditor } from "@/features/notes/components/note-editor";
import type { EditorControls } from "@/features/notes/components/note-editor";
import { useNote, useUpdateNote } from "@/features/notes/hooks";
import type { NoteKind, UpdateNoteRequest } from "@/features/notes/types";
import { useSource } from "@/features/sources/hooks/sources";
import { useAutosaveDraft } from "@/hooks/use-autosave-draft";
import { routes } from "@/lib/routes";

interface NoteDetailViewProps {
  mode: "global" | "source";
  noteId: number;
  sourceId?: number;
}

export function NoteDetailView({ mode, noteId, sourceId }: NoteDetailViewProps) {
  const router = useRouter();
  const isValidNoteId = Number.isInteger(noteId) && noteId > 0;
  const isSourceMode = mode === "source";
  const isValidSourceId = !isSourceMode || (Number.isInteger(sourceId) && (sourceId ?? 0) > 0);

  const { data: note, isLoading, isError } = useNote(noteId);
  const { data: source } = useSource(sourceId ?? 0);
  const updateNote = useUpdateNote();

  const [draft, setDraft] = useState<UpdateNoteRequest>({
    title: "",
    kind: "note",
    body: {},
    citation_ids: [],
    source_id: undefined,
  });
  const [isHydrated, setIsHydrated] = useState(false);
  const expectedUpdatedAtRef = useRef<string | undefined>(undefined);
  const editorControlsRef = useRef<EditorControls | null>(null);

  const globalNotesHref = "/notes";
  const sourceBaseHref = sourceId ? `/library/${sourceId}?tab=notes` : "/library";
  const fallbackHref = isSourceMode ? sourceBaseHref : globalNotesHref;

  useEffect(() => {
    if (!note || isHydrated) return;
    setDraft({
      title: note.title ?? "",
      kind: (note.kind as NoteKind) ?? "note",
      body: (note.body as Record<string, unknown>) ?? {},
      citation_ids: note.citation_ids ?? [],
      source_id: note.source_id,
    });
    expectedUpdatedAtRef.current = note.updated_at;
    setIsHydrated(true);
  }, [note, isHydrated]);

  useEffect(() => {
    if (!isValidNoteId || !isValidSourceId) {
      router.replace(fallbackHref);
    }
  }, [fallbackHref, isValidNoteId, isValidSourceId, router]);

  useEffect(() => {
    if (!isValidNoteId || !isValidSourceId || isLoading) return;
    if (isError || !note) {
      router.replace(fallbackHref);
      return;
    }
    if (isSourceMode && note.source_id !== sourceId) {
      router.replace(fallbackHref);
      return;
    }
    if (!isSourceMode && note.source_id != null) {
      router.replace(routes.sourceNote(note.source_id, note.id));
    }
  }, [fallbackHref, isError, isLoading, isSourceMode, isValidNoteId, isValidSourceId, note, router, sourceId]);

  const { saveState } = useAutosaveDraft<UpdateNoteRequest, UpdateNoteRequest, void>({
    draft,
    enabled: isHydrated,
    debounceMs: 1200,
    isEqual: (a, b) =>
      a.title === b.title &&
      (a.kind ?? "note") === (b.kind ?? "note") &&
      a.source_id === b.source_id &&
      JSON.stringify(a.body) === JSON.stringify(b.body) &&
      JSON.stringify(a.citation_ids ?? []) === JSON.stringify(b.citation_ids ?? []),
    toPayload: (currentDraft) => currentDraft,
    save: async (payload) => {
      const updated = await updateNote.mutateAsync({
        id: noteId,
        data: payload,
        expectedUpdatedAt: expectedUpdatedAtRef.current,
      });
      expectedUpdatedAtRef.current = updated.updated_at;
    },
    validate: (payload) => Boolean(payload.body),
  });

  if (!isValidNoteId || !isValidSourceId) return null;

  const loadingBreadcrumbs = isSourceMode
    ? [
        { label: "Library", href: "/library" },
        { label: source?.title || "Loading...", href: sourceBaseHref },
        { label: "Loading..." },
      ]
    : [
        { label: "Notes", href: globalNotesHref },
        { label: "Loading..." },
      ];

  if (isLoading || !isHydrated) {
    return (
      <div className="flex h-screen flex-col">
        <PageHeader breadcrumbs={<Breadcrumbs items={loadingBreadcrumbs} />} />
        <div className="flex-1 overflow-y-auto">
          <div className="container mx-auto w-full px-4 pb-32 pt-8 md:px-8">
            <div className="text-sm text-muted-foreground">Loading note...</div>
          </div>
        </div>
      </div>
    );
  }

  if (isError || !note) return null;

  const breadcrumbs = isSourceMode
    ? [
        { label: "Library", href: "/library" },
        {
          label: source?.title
            ? source.title.length > 20
              ? `${source.title.slice(0, 20)}...`
              : source.title
            : "Source",
          href: sourceBaseHref,
        },
        { label: draft.title || "Untitled" },
      ]
    : [
        { label: "Notes", href: globalNotesHref },
        { label: draft.title || "Untitled" },
      ];

  return (
    <div className="flex h-screen flex-col">
      <PageHeader
        breadcrumbs={<Breadcrumbs items={breadcrumbs} />}
        actions={
          <div className="h-5 text-xs text-muted-foreground">
            {saveState === "saving" ? (
              <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Saving...
              </span>
            ) : saveState === "error" ? (
              <span className="text-destructive">Save failed</span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                <Check className="h-3.5 w-3.5" />
                Saved
              </span>
            )}
          </div>
        }
      />
      <div className="flex-1 overflow-y-auto">
        <div className="container mx-auto w-full px-4 pb-32 pt-4 md:px-8">
          <input
            autoFocus={draft.title === ""}
            value={draft.title ?? ""}
            onChange={(event) => {
              setDraft((prev) => ({ ...prev, title: event.target.value }));
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                editorControlsRef.current?.focus();
              }
            }}
            placeholder="Untitled"
            className="mb-4 w-full border-none bg-transparent px-0 text-3xl font-bold leading-none tracking-tight outline-none placeholder:text-muted-foreground/25"
          />

          <div className="mb-4 flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Type:</span>
            <DropdownMenu>
              <DropdownMenuTrigger>
                <Badge
                  variant="secondary"
                  className="h-7 cursor-pointer rounded-full border border-border/60 px-3 text-[11px] uppercase tracking-[0.12em] transition-colors hover:bg-muted/80 hover:border-border"
                >
                  {(draft.kind ?? "note").toUpperCase()}
                </Badge>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="min-w-28">
                {(["note", "insight"] as NoteKind[]).map((kind) => (
                  <DropdownMenuItem
                    key={kind}
                    onClick={() => {
                      setDraft((prev) => ({ ...prev, kind }));
                    }}
                  >
                    {kind === "note" ? "Note" : "Insight"}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <NoteEditor
            initialContent={draft.body}
            sourceId={draft.source_id}
            onBodyChange={(payload) => {
              setDraft((prev) => ({
                ...prev,
                body: payload.body as Record<string, unknown>,
                citation_ids: payload.citationIds,
              }));
            }}
            onEditorReady={(controls) => {
              editorControlsRef.current = controls;
            }}
          />
        </div>
      </div>
    </div>
  );
}
