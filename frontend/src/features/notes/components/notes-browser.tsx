"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import type { NoteListDTO } from "@/features/notes/types";
import { LOCAL_STORAGE_KEYS, useLocalStorage } from "@/hooks/use-local-storage";
import { formatDateUTC, timeAgo } from "@/lib/utils/date";
import {
  ChevronDown,
  FileText,
  LayoutGrid,
  List,
  MoreHorizontal,
  NotebookPen,
  Plus,
  Search,
} from "lucide-react";
import { Link } from "@/lib/nav";
import { useMemo, useState } from "react";

type ViewMode = "list" | "grid";
type SortKey = "updated" | "created" | "title";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

const SORT_LABELS: Record<SortKey, string> = {
  updated: "Updated",
  created: "Created",
  title: "Title",
};

function formatNoteDate(updatedAt: string): string {
  const date = new Date(updatedAt);
  if (Number.isNaN(date.getTime())) return "";
  const diff = Date.now() - date.getTime();
  if (diff < SEVEN_DAYS_MS) return timeAgo(updatedAt);
  return formatDateUTC(updatedAt, { month: "short", day: "numeric", year: "numeric" });
}

function sortNotes(notes: NoteListDTO[], sort: SortKey): NoteListDTO[] {
  const copy = [...notes];
  switch (sort) {
    case "updated":
      return copy.sort(
        (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
      );
    case "created":
      return copy.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
    case "title":
      return copy.sort((a, b) =>
        (a.title || "Untitled").localeCompare(b.title || "Untitled"),
      );
  }
}

interface NotesBrowserProps {
  createLabel?: string;
  emptyMessage: string;
  getNoteHref?: (note: NoteListDTO) => string;
  isCreatePending?: boolean;
  isLoading: boolean;
  notes: NoteListDTO[];
  onCreate?: () => void | Promise<void>;
  selectedNoteId?: number | null;
  onNoteSelect?: (note: NoteListDTO) => void;
}

export function NotesBrowser({
  createLabel = "New Note",
  emptyMessage,
  getNoteHref = (note) => `/notes/${note.id}`,
  isCreatePending = false,
  isLoading,
  notes,
  onCreate,
  selectedNoteId = null,
  onNoteSelect,
}: NotesBrowserProps) {
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useLocalStorage<ViewMode>(
    LOCAL_STORAGE_KEYS.NOTES_VIEW_MODE,
    "grid",
  );
  const [sort, setSort] = useLocalStorage<SortKey>(
    LOCAL_STORAGE_KEYS.NOTES_SORT,
    "updated",
  );

  const filteredAndSorted = useMemo(() => {
    const filtered = search
      ? notes.filter((note) =>
          note.title.toLowerCase().includes(search.toLowerCase()),
        )
      : notes;
    return sortNotes(filtered, sort);
  }, [notes, search, sort]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="relative w-full md:max-w-sm">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search notes…"
            className="pl-8"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button size="sm" variant="outline" className="gap-1.5">
                  <span className="text-muted-foreground">Sort:</span>
                  <span>{SORT_LABELS[sort]}</span>
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              }
            />
            <DropdownMenuContent align="end">
              <DropdownMenuRadioGroup
                value={sort}
                onValueChange={(value) => setSort(value as SortKey)}
              >
                <DropdownMenuRadioItem value="updated">Updated</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="created">Created</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="title">Title</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="flex items-center rounded-md border border-border/60 p-0.5">
            <Button
              size="icon"
              variant={viewMode === "list" ? "secondary" : "ghost"}
              className="h-7 w-7"
              onClick={() => setViewMode("list")}
              aria-label="List view"
              aria-pressed={viewMode === "list"}
            >
              <List className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant={viewMode === "grid" ? "secondary" : "ghost"}
              className="h-7 w-7"
              onClick={() => setViewMode("grid")}
              aria-label="Grid view"
              aria-pressed={viewMode === "grid"}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
          </div>

          {onCreate && (
            <Button size="sm" onClick={() => void onCreate()} disabled={isCreatePending}>
              <Plus className="mr-1.5 h-4 w-4" />
              {createLabel}
            </Button>
          )}
        </div>
      </div>

      {!isLoading && filteredAndSorted.length > 0 && (
        <div className="flex justify-end text-xs text-muted-foreground">
          {filteredAndSorted.length} {filteredAndSorted.length === 1 ? "note" : "notes"}
        </div>
      )}

      {isLoading ? (
        viewMode === "list" ? (
          <div className="flex flex-col overflow-hidden rounded-lg border border-border/50 bg-card">
            {Array.from({ length: 8 }).map((_, index) => (
              <div
                key={index}
                className={`h-20 animate-pulse bg-muted/10 ${
                  index === 7 ? "" : "border-b border-border/40"
                }`}
              />
            ))}
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <div key={index} className="h-28 animate-pulse border border-border/40 bg-muted/20" />
            ))}
          </div>
        )
      ) : filteredAndSorted.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-24 text-center">
          <NotebookPen className="h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            {search ? "No notes match your search." : emptyMessage}
          </p>
          {!search && onCreate && (
            <Button variant="outline" size="sm" onClick={() => void onCreate()} disabled={isCreatePending}>
              <Plus className="mr-1.5 h-4 w-4" />
              {createLabel}
            </Button>
          )}
        </div>
      ) : viewMode === "list" ? (
        <ListView
          notes={filteredAndSorted}
          selectedNoteId={selectedNoteId}
          onNoteSelect={onNoteSelect}
          getNoteHref={getNoteHref}
        />
      ) : (
        <GridView
          notes={filteredAndSorted}
          selectedNoteId={selectedNoteId}
          onNoteSelect={onNoteSelect}
          getNoteHref={getNoteHref}
        />
      )}
    </div>
  );
}

interface ViewProps {
  notes: NoteListDTO[];
  selectedNoteId: number | null;
  onNoteSelect?: (note: NoteListDTO) => void;
  getNoteHref: (note: NoteListDTO) => string;
}

function NoteIconTile() {
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-border/50 bg-muted/40">
      <FileText className="h-4.5 w-4.5 text-muted-foreground" />
    </div>
  );
}

function RowMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100"
            aria-label="More actions"
            onClick={(event) => event.stopPropagation()}
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        }
      />
      <DropdownMenuContent align="end" onClick={(event) => event.stopPropagation()}>
        <DropdownMenuItem disabled>Open</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled className="text-destructive">
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ListView({ notes, selectedNoteId, onNoteSelect, getNoteHref }: ViewProps) {
  return (
    <div className="flex flex-col overflow-hidden rounded-lg border border-border/50 bg-card">
      {notes.map((note, index) => {
        const isSelected = selectedNoteId === note.id;
        const isLast = index === notes.length - 1;
        const rowClass = `group relative flex items-start gap-3 px-4 py-3.5 text-left transition-colors w-full min-w-0 ${
          isLast ? "" : "border-b border-border/40"
        } ${isSelected ? "bg-muted/40" : "hover:bg-muted/30"}`;

        const body = (
          <>
            <NoteIconTile />
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <div className="flex items-center gap-2 min-w-0">
                <span className="truncate font-medium leading-snug">
                  {note.title || "Untitled"}
                </span>
                {note.kind && note.kind !== "note" && (
                  <Badge
                    variant="secondary"
                    className="shrink-0 uppercase tracking-wide text-[10px]"
                  >
                    {note.kind}
                  </Badge>
                )}
              </div>
              {note.preview && (
                <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                  {note.preview}
                </p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-1 pt-0.5">
              <span className="text-xs text-muted-foreground/70">
                {formatNoteDate(note.updated_at)}
              </span>
              <RowMenu />
            </div>
          </>
        );

        if (onNoteSelect) {
          return (
            <div
              key={note.id}
              role="button"
              tabIndex={0}
              className={`${rowClass} cursor-pointer`}
              onClick={() => onNoteSelect(note)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onNoteSelect(note);
                }
              }}
            >
              {body}
            </div>
          );
        }

        return (
          <Link key={note.id} href={getNoteHref(note)} className={rowClass}>
            {body}
          </Link>
        );
      })}
    </div>
  );
}

function GridView({ notes, selectedNoteId, onNoteSelect, getNoteHref }: ViewProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {notes.map((note) => {
        const isSelected = selectedNoteId === note.id;
        const cardClass = `group flex flex-col gap-2 border p-4 transition-colors text-left w-full min-w-0 ${
          isSelected
            ? "border-border bg-card/90 ring-1 ring-inset ring-border"
            : "border-border/50 bg-card/40 hover:border-border/80 hover:bg-card/70"
        }`;

        const cardContent = (
          <>
            <div className="flex items-start justify-between gap-2 min-w-0">
              <div className="flex min-w-0 items-center gap-2">
                <NoteIconTile />
                <span className="font-semibold leading-snug tracking-tight truncate min-w-0">
                  {note.title || "Untitled"}
                </span>
              </div>
              <span className="shrink-0 text-xs text-muted-foreground/60">
                {formatNoteDate(note.updated_at)}
              </span>
            </div>
            {note.kind && note.kind !== "note" && (
              <Badge variant="secondary" className="self-start uppercase tracking-wide text-[10px]">
                {note.kind}
              </Badge>
            )}
            {note.preview && (
              <p className="line-clamp-4 text-sm leading-relaxed text-muted-foreground">
                {note.preview}
              </p>
            )}
          </>
        );

        if (onNoteSelect) {
          return (
            <div
              key={note.id}
              role="button"
              tabIndex={0}
              className={`${cardClass} cursor-pointer`}
              onClick={() => onNoteSelect(note)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onNoteSelect(note);
                }
              }}
            >
              {cardContent}
            </div>
          );
        }

        return (
          <Link key={note.id} href={getNoteHref(note)} className={cardClass}>
            {cardContent}
          </Link>
        );
      })}
    </div>
  );
}
