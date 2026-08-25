"use client";

import { Link } from "@/lib/nav";
import { memo, useMemo } from "react";
import { Quote, MessageSquare, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useSources } from "@/features/sources/hooks/sources";
import { useTags } from "@/features/tags/hooks";
import { SourceIcon } from "@/features/sources/components/source-header/components/source-icon";
import type { SourceDTO } from "@/features/sources/types";
import { colorForTag } from "@/features/graph/lib/colors";

interface TagSourcesSheetProps {
  tagId: number | null;
  onClose: () => void;
  onSelectSource: (sourceId: number) => void;
  // Set of source IDs that actually have a node on the graph. Sources without
  // any takeaways/notes aren't part of simNodes (use-graph-data filters them
  // out), so clicking them would silently do nothing through the inspector
  // route — fall back to a library link for those.
  graphSourceIds: Set<number>;
  // Hover preview → ask the graph to pulse + pan to the matching node. Pass
  // null to clear. Only fires for sources that exist on the graph.
  onHoverSource?: (sourceId: number | null) => void;
}

export const TagSourcesSheet = memo(function TagSourcesSheet({
  tagId,
  onClose,
  onSelectSource,
  graphSourceIds,
  onHoverSource,
}: TagSourcesSheetProps) {
  const { data: sourcesData, isPending: sourcesLoading } = useSources();
  const { data: tagsData } = useTags();

  const tag = useMemo(
    () => (tagId == null ? null : tagsData?.find((t) => t.id === tagId) ?? null),
    [tagsData, tagId],
  );

  const taggedSources = useMemo<SourceDTO[]>(() => {
    if (tagId == null) return [];
    return (sourcesData?.sources ?? []).filter((s) =>
      s.tag_ids?.includes(tagId),
    );
  }, [sourcesData, tagId]);

  if (tagId == null) return null;

  const tagColor = tag?.color || colorForTag(tagId);
  const label = tag?.label ?? `#${tagId}`;

  return (
    <aside
      className="absolute top-4 right-4 bottom-4 z-20 w-[min(380px,calc(100vw-2rem))] rounded-md border bg-card/95 backdrop-blur shadow-lg flex flex-col cursor-default"
      onPointerDown={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
    >
      <div className="flex items-start justify-between gap-3 border-b px-4 py-3">
        <div className="min-w-0 space-y-2 flex-1">
          <div className="flex items-center gap-2">
            <span
              className="inline-block size-2 rounded-full shrink-0"
              style={{ backgroundColor: tagColor }}
            />
            <Badge variant="outline" className="uppercase text-[10px]">
              tag
            </Badge>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {taggedSources.length}{" "}
              {taggedSources.length === 1 ? "source" : "sources"}
            </span>
          </div>
          <h2 className="text-sm font-semibold leading-snug line-clamp-2">
            {label}
          </h2>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label="Close"
          onClick={onClose}
          className="shrink-0"
        >
          <X />
        </Button>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div className="px-2 py-2 text-xs">
          {sourcesLoading ? (
            <div className="space-y-2 px-2 py-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-start gap-2 py-1.5">
                  <Skeleton className="size-9 rounded" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3.5 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : taggedSources.length === 0 ? (
            <p className="px-2 py-6 text-center text-muted-foreground">
              No sources tagged with this theme yet.
            </p>
          ) : (
            <ul className="space-y-0.5">
              {taggedSources.map((source) => {
                const inGraph = graphSourceIds.has(source.id);
                const body = (
                  <>
                    <SourceThumb source={source} />
                    <div className="flex-1 min-w-0 space-y-0.5">
                      <p className="line-clamp-2 text-foreground leading-snug">
                        {source.title}
                      </p>
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground tabular-nums">
                        <span className="inline-flex items-center gap-1">
                          <Quote className="size-3" />
                          {source.citation_count ?? 0}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <MessageSquare className="size-3" />
                          {source.capture_count ?? 0}
                        </span>
                      </div>
                    </div>
                  </>
                );
                const rowClass =
                  "w-full text-left group flex items-start gap-2 rounded px-2 py-1.5 cursor-pointer hover:bg-muted/60 transition-colors";
                return (
                  <li key={source.id}>
                    {inGraph ? (
                      <button
                        type="button"
                        onClick={() => onSelectSource(source.id)}
                        onPointerEnter={() => onHoverSource?.(source.id)}
                        onPointerLeave={() => onHoverSource?.(null)}
                        className={rowClass}
                      >
                        {body}
                      </button>
                    ) : (
                      <Link href={`/library/${source.id}`} className={rowClass}>
                        {body}
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </ScrollArea>
    </aside>
  );
});

function SourceThumb({ source }: { source: SourceDTO }) {
  if (source.image_url) {
    return (
      <div className="size-9 rounded overflow-hidden border bg-secondary shrink-0">
        <img
          src={source.image_url}
          alt=""
          className="w-full h-full object-cover"
          loading="lazy"
        />
      </div>
    );
  }
  return (
    <div className="size-9 rounded flex items-center justify-center bg-secondary/40 shrink-0">
      <SourceIcon
        type={source.type}
        className="h-4 w-4 text-muted-foreground"
      />
    </div>
  );
}
