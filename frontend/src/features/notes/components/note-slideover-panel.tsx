"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { NoteEditor } from "@/features/notes/components/note-editor";
import { useNote, useUpdateNote } from "@/features/notes/hooks";
import type { NoteKind, NoteListDTO, UpdateNoteRequest } from "@/features/notes/types";
import type { EmbeddedSourceRef } from "@/features/notes/utils/extract-refs";
import { extractSourceRefs } from "@/features/notes/utils/extract-refs";
import { SourceIcon } from "@/features/sources/components/source-header/components/source-icon";
import { useSource } from "@/features/sources/hooks/sources";
import { useAutosaveDraft } from "@/hooks/use-autosave-draft";
import { routes } from "@/lib/routes";
import { timeAgo } from "@/lib/utils/date";
import type { JSONContent } from "@tiptap/core";
import { Check, Expand, Loader2, MoreHorizontal, X } from "lucide-react";
import { useRouter } from "@/lib/nav";
import { useEffect, useMemo, useRef, useState } from "react";

interface NoteSlideoverPanelProps {
  note: NoteListDTO;
  onClose: () => void;
}

function LinkedSourceRow({ sourceId }: { sourceId: number }) {
  const { data: source } = useSource(sourceId);
  const router = useRouter();

  const title = source?.title ?? "Untitled source";
  const type = source?.type ?? "";
  const imageUrl = source?.image_url;
  const author = source?.author;
  const date = source?.created_at ? timeAgo(source.created_at) : null;

  return (
    <button
      type="button"
      onClick={() => router.push(routes.source(sourceId))}
      className="flex w-full cursor-pointer items-center gap-3 rounded-md px-2 py-2.5 text-left hover:bg-muted/60 transition-colors"
    >
      <div className="h-10 w-10 shrink-0 rounded overflow-hidden bg-muted flex items-center justify-center">
        {imageUrl ? (
          <img src={imageUrl} alt={title} className="h-full w-full object-cover" />
        ) : (
          <SourceIcon type={type} className="h-5 w-5 text-muted-foreground" />
        )}
      </div>
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="truncate text-sm font-medium leading-snug">{title}</p>
        {(author ?? date) && (
          <p className="truncate text-xs text-muted-foreground">
            {[author, date].filter(Boolean).join(" · ")}
          </p>
        )}
      </div>
      {type && (
        <Badge variant="secondary" className="shrink-0 capitalize text-[10px]">
          {type}
        </Badge>
      )}
    </button>
  );
}

export function NoteSlideoverPanel({ note, onClose }: NoteSlideoverPanelProps) {
  const router = useRouter();
  const { data: fullNote, isLoading } = useNote(note.id);
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

  useEffect(() => {
    if (!fullNote) return;
    setDraft({
      title: fullNote.title ?? "",
      kind: (fullNote.kind as NoteKind) ?? "note",
      body: (fullNote.body as Record<string, unknown>) ?? {},
      citation_ids: fullNote.citation_ids ?? [],
      source_id: fullNote.source_id,
    });
    expectedUpdatedAtRef.current = fullNote.updated_at;
    setIsHydrated(true);
  }, [fullNote]);

  // Reset hydration when the selected note changes
  useEffect(() => {
    setIsHydrated(false);
  }, [note.id]);

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
        id: note.id,
        data: payload,
        expectedUpdatedAt: expectedUpdatedAtRef.current,
      });
      expectedUpdatedAtRef.current = updated.updated_at;
    },
    validate: (payload) => Boolean(payload.body),
  });

  const sourceRefs = useMemo((): EmbeddedSourceRef[] => {
    if (!isHydrated) return [];
    return extractSourceRefs(draft.body as JSONContent);
  }, [draft.body, isHydrated]);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 px-5 pt-5 pb-4 space-y-2">
        <div className="flex items-start justify-between gap-3">
          <input
            value={draft.title ?? ""}
            onChange={(event) => {
              setDraft((prev) => ({ ...prev, title: event.target.value }));
            }}
            placeholder="Untitled"
            disabled={!isHydrated}
            className="min-w-0 flex-1 border-none bg-transparent px-0 text-xl font-bold leading-snug tracking-tight outline-none placeholder:text-muted-foreground/25"
          />
          <div className="flex shrink-0 items-center gap-0.5 pt-1">
            <span className="flex items-center gap-1 text-xs text-muted-foreground whitespace-nowrap mr-1">
              {saveState === "saving" ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Saving...
                </>
              ) : saveState === "error" ? (
                <span className="text-destructive">Save failed</span>
              ) : (
                <>
                  <Check className="h-3 w-3" />
                  {timeAgo(expectedUpdatedAtRef.current ?? note.updated_at)}
                </>
              )}
            </span>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground">
              <MoreHorizontal className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground"
              onClick={() => router.push(routes.note(note.id))}
              title="Open full page"
            >
              <Expand className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground"
              onClick={onClose}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger disabled={!isHydrated}>
            <Badge
              variant="secondary"
              className="h-6 cursor-pointer rounded-full border border-border/60 px-2.5 text-[10px] uppercase tracking-[0.12em] transition-colors hover:bg-muted/80 hover:border-border"
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

      <div className="shrink-0 border-t border-border" />

      {/* Scrollable body */}
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 space-y-8">
        {isLoading || !isHydrated ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        ) : (
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
          />
        )}

        {sourceRefs.length > 0 && (
          <div className="space-y-1 border-t border-border pt-6">
            <p className="px-2 pb-2 text-sm font-semibold">Linked sources</p>
            {sourceRefs.map((ref) => (
              <LinkedSourceRow key={ref.sourceId} sourceId={ref.sourceId} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
