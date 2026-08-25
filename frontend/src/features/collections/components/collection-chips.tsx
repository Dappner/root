"use client";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Layers } from "lucide-react";
import { useCollections } from "../hooks";

export interface CollectionChipCollection {
  id: number;
  name: string;
}

interface CollectionChipsProps {
  collectionIds: number[];
  collectionsById?: Record<number, CollectionChipCollection | undefined>;
}

export function CollectionChips({
  collectionIds,
  collectionsById,
}: CollectionChipsProps) {
  const { data: allCollections = [], isLoading } = useCollections();

  if (collectionIds.length === 0) return null;

  const matched = collectionsById
    ? collectionIds
      .map((collectionId) => collectionsById[collectionId])
      .filter((collection): collection is CollectionChipCollection => Boolean(collection))
    : allCollections.filter((c) => collectionIds.includes(c.id));

  if (!collectionsById && isLoading) return null;
  if (matched.length === 0) return null;

  const label =
    matched.length === 1 ? matched[0].name : `${matched.length} collections`;

  return (
    <Tooltip>
      <TooltipTrigger className="flex items-center gap-1 text-muted-foreground/70 hover:text-muted-foreground transition-colors cursor-default">
        <Layers className="size-3.5" />
        <span className="text-xs">
          {matched.length === 1 ? "1 collection" : `${matched.length} collections`}
        </span>
      </TooltipTrigger>
      <TooltipContent>
        <p className="text-xs">{label}</p>
      </TooltipContent>
    </Tooltip>
  );
}
