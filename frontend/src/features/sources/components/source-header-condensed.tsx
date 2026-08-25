"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { useSource } from "@/features/sources/hooks/sources";
import { buildMetadataBadges } from "@/features/sources/utils/metadata";
import { Link } from "@/lib/nav";
import { SourceIcon } from "./source-header/components/source-icon";

interface SourceHeaderCondensedProps {
  sourceId: number;
}

export function SourceHeaderCondensed({ sourceId }: SourceHeaderCondensedProps) {
  const { data: source, isLoading } = useSource(sourceId);

  if (isLoading || !source) {
    return (
      <div className="flex items-center gap-2">
        <Skeleton className="h-4 w-4" />
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-3 w-24" />
      </div>
    );
  }

  const badges = buildMetadataBadges(source);

  return (
    <Link
      href={`/library/${sourceId}?tab=highlights`}
      className="flex items-center gap-2 group w-fit"
    >
      <SourceIcon
        type={source.type}
        className="h-4 w-4 text-muted-foreground shrink-0"
      />
      <span className="text-sm font-medium group-hover:text-foreground transition-colors truncate max-w-xs">
        {source.title || "Untitled"}
      </span>
      {badges.length > 0 && (
        <span className="text-xs text-muted-foreground/60 hidden sm:inline truncate">
          {badges[0]}
        </span>
      )}
    </Link>
  );
}
