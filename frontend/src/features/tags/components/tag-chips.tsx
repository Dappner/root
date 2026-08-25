"use client";

import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { X } from "lucide-react";
import { useTags } from "../hooks";

export interface TagChipTag {
  id: number;
  label: string;
}

interface TagChipsProps {
  tagIds: number[];
  className?: string;
  onRemove?: (tagId: number) => void;
  tagsById?: Record<number, TagChipTag | undefined>;
}

export function TagChips({
  tagIds,
  className,
  onRemove,
  tagsById,
}: TagChipsProps) {
  const { data: allTags = [], isLoading } = useTags();

  if (!tagsById && isLoading) {
    return (
      <div className="flex items-center gap-1.5 flex-wrap">
        {tagIds.length > 0 && <Skeleton className="h-5 w-16" />}
      </div>
    );
  }

  // Filter to only selected tags
  const selectedTags = tagsById
    ? tagIds
      .map((tagId) => tagsById[tagId])
      .filter((tag): tag is TagChipTag => Boolean(tag))
    : allTags.filter((tag) => tagIds.includes(tag.id));

  if (selectedTags.length === 0) {
    return null;
  }

  return (
    <div className={className ?? "flex items-center gap-1.5 flex-wrap"}>
      {selectedTags.map((tag) => (
        <Badge
          key={tag.id}
          variant="secondary"
          className="h-5 px-2 text-xs flex items-center gap-1"
        >
          <span>{tag.label}</span>
          {onRemove && (
            <button
              type="button"
              onClick={() => onRemove(tag.id)}
              className="rounded-full hover:bg-muted-foreground/20 focus:outline-none focus:ring-1 focus:ring-ring"
              aria-label={`Remove tag ${tag.label}`}
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </Badge>
      ))}
    </div>
  );
}
