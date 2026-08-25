import { useDialog } from "@/components/dialogs";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { CitationDialog } from "@/features/sources/dialogs/citation-dialog";
import { Highlighter } from "lucide-react";

interface EmptyHighlightsStateProps {
  sourceId: number;
}

export function EmptyHighlightsState({ sourceId }: EmptyHighlightsStateProps) {
  const { openDialog } = useDialog();

  return (
    <Empty className="bg-muted/20 animate-in fade-in duration-500 rounded-lg">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Highlighter className="size-5" />
        </EmptyMedia>
        <EmptyTitle>No highlights yet</EmptyTitle>
        <EmptyDescription>
          Add a quote or comment from this source to see them here.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button
          onClick={() => openDialog(CitationDialog, {
            mode: "create",
            flow: "manual",
            sourceId,
          })}
          className="mt-2"
        >
          Add your first quote
        </Button>
      </EmptyContent>
    </Empty>
  );
}
