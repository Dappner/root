"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { useSourceNotes } from "@/features/notes/hooks";
import type { NoteListDTO } from "@/features/notes/types";
import { formatDateUTC, timeAgo } from "@/lib/utils/date";
import { FileText } from "lucide-react";
import { Link } from "@/lib/nav";

interface SourceRecentNotesProps {
  sourceId: number;
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_NOTES = 3;

function formatNoteDate(updatedAt: string): string {
  const date = new Date(updatedAt);
  if (Number.isNaN(date.getTime())) return "";
  const diff = Date.now() - date.getTime();
  if (diff < SEVEN_DAYS_MS) return timeAgo(updatedAt);
  return formatDateUTC(updatedAt, { month: "short", day: "numeric" });
}

function sortByUpdated(notes: NoteListDTO[]): NoteListDTO[] {
  return [...notes].sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
  );
}

export function SourceRecentNotes({ sourceId }: SourceRecentNotesProps) {
  const { data: notes, isLoading } = useSourceNotes(sourceId);

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Recent notes</h3>
        </div>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-4 w-4" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-4 w-12" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const items = sortByUpdated(notes ?? []).slice(0, MAX_NOTES);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Recent notes</h3>
        {(notes?.length ?? 0) > 0 && (
          <Link
            href={`/library/${sourceId}/notes`}
            className="text-xs text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
          >
            See all
          </Link>
        )}
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">
          No notes for this source yet.
        </p>
      ) : (
        <ul className="space-y-1">
          {items.map((note) => (
            <li key={note.id}>
              <Link
                href={`/library/${sourceId}/notes/${note.id}`}
                className="flex items-center gap-3 py-1.5 text-sm hover:bg-muted/50 rounded-md px-2 -mx-2 transition-colors"
              >
                <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="flex-1 truncate">
                  {note.title || (
                    <span className="text-muted-foreground italic">Untitled</span>
                  )}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatNoteDate(note.updated_at)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
