"use client";

import { Link } from "@/lib/nav";
import { ChevronRight, FileText } from "lucide-react";
import { routes } from "@/lib/routes";
import { timeAgo } from "@/lib/utils/date";
import type { NoteListDTO } from "@/features/notes/types";

interface AnalyticalRecentNotesProps {
  notes: NoteListDTO[];
  isLoading?: boolean;
}

export function AnalyticalRecentNotes({ notes, isLoading }: AnalyticalRecentNotesProps) {
  const recent = notes.slice(0, 5);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Recent notes</h3>
        <Link href={routes.notes} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
          View all
        </Link>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3 animate-pulse">
              <div className="h-10 w-10 rounded bg-muted shrink-0" />
              <div className="flex-1 space-y-1">
                <div className="h-3 w-36 bg-muted rounded" />
                <div className="h-3 w-48 bg-muted rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : recent.length === 0 ? (
        <p className="text-xs text-muted-foreground py-4">No notes yet.</p>
      ) : (
        <div className="space-y-1">
          {recent.map((note) => {
            const lastActive = timeAgo(note.updated_at);

            return (
              <Link
                key={note.id}
                href={`/notes/${note.id}`}
                className="flex items-center gap-3 rounded-lg px-2 py-3 hover:bg-muted/50 transition-colors group"
              >
                <div className="h-10 w-10 rounded bg-muted flex items-center justify-center shrink-0">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </div>

                <div className="flex-1 min-w-0 space-y-1">
                  <p className="text-sm font-medium leading-tight truncate">
                    {note.title || "Untitled"}
                  </p>
                  {note.preview && (
                    <p className="text-xs text-muted-foreground leading-tight truncate">
                      {note.preview}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-1 shrink-0 text-xs text-muted-foreground tabular-nums">
                  <span>{lastActive}</span>
                  <ChevronRight className="h-3 w-3 opacity-40 group-hover:opacity-70 transition-opacity" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
