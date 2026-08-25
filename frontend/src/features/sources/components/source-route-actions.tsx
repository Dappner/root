"use client";

import { useDialog } from "@/components/dialogs";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DeleteSourceDialog } from "@/features/sources/dialogs/delete-source-dialog";
import { EditSourceDialog } from "@/features/sources/dialogs/edit-source-dialog";
import { useRegenerateSections } from "@/features/sources/hooks/sections";
import type { SourceDTO } from "@/features/sources/types";
import { Loader2, MoreVertical, Pencil, Sparkles, Trash2 } from "lucide-react";

interface SourceRouteActionsProps {
  source: SourceDTO;
}

export function SourceRouteActions({ source }: SourceRouteActionsProps) {
  const { openDialog } = useDialog();
  const regenerate = useRegenerateSections();
  const isAv = !!(source.episode_id || source.video_id);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="sm" aria-label="More actions">
            <MoreVertical className="h-4 w-4" />
          </Button>
        }
      />
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => openDialog(EditSourceDialog, { source })}>
          <Pencil className="h-4 w-4 mr-2" />
          Edit source
        </DropdownMenuItem>
        {isAv && (
          <DropdownMenuItem
            onClick={() => regenerate.mutate(source.id)}
            disabled={regenerate.isPending}
          >
            {regenerate.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4 mr-2" />
            )}
            {regenerate.isPending ? "Generating sections…" : "Regenerate sections"}
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() =>
            openDialog(DeleteSourceDialog, {
              sourceId: source.id,
              sourceTitle: source.title ?? "Untitled",
            })
          }
          className="text-destructive focus:text-destructive"
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Delete source
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
