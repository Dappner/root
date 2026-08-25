"use client";

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
import { CreateSourceDialog } from "@/features/sources/dialogs/create-source-dialog";
import type { SourceType } from "@/features/sources/types";
import { BookOpen, Plus } from "lucide-react";

interface SourcesEmptyStateProps {
  type?: string;
}

const emptyStateContent: Record<
  SourceType | "default",
  {
    title: string;
    description: string;
    actionLabel: string;
    defaultType: SourceType;
  }
> = {
  book: {
    title: "No books yet",
    description:
      "Add your first book source and begin capturing insights from your reading.",
    actionLabel: "Add your first book",
    defaultType: "book",
  },
  article: {
    title: "No articles yet",
    description:
      "Add your first article source and begin capturing key insights.",
    actionLabel: "Add your first article",
    defaultType: "article",
  },
  video: {
    title: "No videos yet",
    description:
      "Add your first video source and begin capturing insights from what you watch.",
    actionLabel: "Add your first video",
    defaultType: "video",
  },
  podcast: {
    title: "No podcasts yet",
    description:
      "Add your first podcast source and begin capturing insights from what you listen to.",
    actionLabel: "Add your first podcast",
    defaultType: "podcast",
  },
  pdf: {
    title: "No PDFs yet",
    description:
      "Add your first PDF source and begin capturing highlights from your documents.",
    actionLabel: "Add your first PDF",
    defaultType: "pdf",
  },
  default: {
    title: "Start building your knowledge base",
    description:
      "Add your first source and begin capturing insights.",
    actionLabel: "Add your first source",
    defaultType: "book",
  },
};

export function SourcesEmptyState({ type }: SourcesEmptyStateProps) {
  const { openDialog } = useDialog();
  const content =
    emptyStateContent[(type as SourceType) ?? "default"] ??
    emptyStateContent.default;

  return (
    <Empty className="bg-muted/20 animate-in fade-in duration-500 rounded-lg">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <BookOpen className="size-5" />
        </EmptyMedia>
        <EmptyTitle>{content.title}</EmptyTitle>
        <EmptyDescription>{content.description}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button
          onClick={() =>
            openDialog(CreateSourceDialog, {
              defaultType: content.defaultType,
            })
          }
          className="mt-2"
        >
          <Plus className="h-4 w-4 mr-2" />
          {content.actionLabel}
        </Button>
      </EmptyContent>
    </Empty>
  );
}
