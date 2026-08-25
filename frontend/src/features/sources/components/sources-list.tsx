"use client";

import {
  Empty,
  EmptyDescription,
  EmptyHeader,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronDown, ChevronRight, X } from "lucide-react";
import { useCollections } from "@/features/collections/hooks";
import { useSources } from "@/features/sources/hooks/sources";
import { useTags } from "@/features/tags/hooks";
import { usePathname, useRouter, useSearchParams } from "@/lib/nav";
import { useMemo, useState } from "react";
import type { SourceType } from "../types";
import { SourceListItem } from "./source-list-item";
import { SourcesEmptyState } from "./sources-empty-state";

interface SourcesListProps {
  hideInCollections?: boolean;
  statusFilter?: string;
  type?: SourceType;
  search?: string;
}

export function SourcesList({ type, statusFilter, hideInCollections = false, search = "" }: SourcesListProps) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({ done: true });
  const toggleCollapsed = (status: string) =>
    setCollapsed((prev) => ({ ...prev, [status]: !prev[status] }));
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const setStatusFilter = (status: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (status) {
      params.set("status", status);
    } else {
      params.delete("status");
    }
    router.push(`${pathname}?${params.toString()}`);
  };
  const { data: sourcesListResponse, isPending, error } = useSources(type);
  const { data: collections = [] } = useCollections();
  const { data: tags = [] } = useTags();

  const collectionsById = useMemo(
    () =>
      Object.fromEntries(
        collections.map((collection) => [
          collection.id,
          { id: collection.id, name: collection.name },
        ]),
      ),
    [collections],
  );

  const tagsById = useMemo(
    () =>
      Object.fromEntries(
        tags.map((tag) => [
          tag.id,
          { id: tag.id, label: tag.label },
        ]),
      ),
    [tags],
  );

  if (isPending) {
    return (
      <div className="space-y-6">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="py-4 border-b last:border-b-0">
            <div className="flex items-start gap-5">
              <Skeleton className="size-20 rounded-lg" />
              <div className="flex-1 space-y-2.5">
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-4 w-full max-w-md" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Empty className="py-12 rounded-xl animate-in fade-in duration-300">
        <EmptyHeader>
          <EmptyDescription className="text-destructive">
            {error instanceof Error ? error.message : "Failed to load sources"}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  const searchLower = search.toLowerCase();
  const sources = (sourcesListResponse?.sources ?? []).filter((source) => {
    if (statusFilter && source.status !== statusFilter) return false;
    if (hideInCollections && source.collection_ids && source.collection_ids.length > 0) return false;
    if (searchLower && !source.title?.toLowerCase().includes(searchLower)) return false;
    return true;
  });

  if (sources.length === 0) {
    if (searchLower) {
      return (
        <Empty className="py-12 rounded-xl animate-in fade-in duration-300">
          <EmptyHeader>
            <EmptyDescription>No sources match &ldquo;{search}&rdquo;.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      );
    }

    return <SourcesEmptyState type={type} />;
  }

  const groups = groupSourcesByStatus(sources);
  const visibleGroups = STAGE_GROUPS.filter((g) => groups[g.status]?.length);

  const showHeaders = visibleGroups.length > 1 && !statusFilter;

  const activeGroup = statusFilter ? STAGE_GROUPS.find((g) => g.status === statusFilter) : null;

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {statusFilter && activeGroup && (
        <div className="flex items-center gap-2">
          <span className={`size-1.5 rounded-full ${activeGroup.dotColor}`} />
          <span className="text-sm font-medium">{activeGroup.label}</span>
          <button
            type="button"
            onClick={() => setStatusFilter(null)}
            className="ml-1 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            <X className="size-3" />
            Clear
          </button>
        </div>
      )}
      {visibleGroups.map((group) => {
        const isCollapsed = !!collapsed[group.status] && !statusFilter;
        const count = groups[group.status]!.length;

        return (
          <div key={group.status}>
            {showHeaders && (
              <div className="flex items-center gap-3 mb-3">
                <button
                  type="button"
                  onClick={() => toggleCollapsed(group.status)}
                  className="cursor-pointer flex items-center justify-center size-5 rounded hover:bg-muted text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                  aria-label={isCollapsed ? "Expand" : "Collapse"}
                >
                  {isCollapsed
                    ? <ChevronRight className="size-3.5" />
                    : <ChevronDown className="size-3.5" />
                  }
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter(group.status)}
                  className="flex items-center gap-2 group/header cursor-pointer"
                >
                  <span className={`size-1.5 rounded-full shrink-0 ${group.dotColor}`} />
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider group-hover/header:text-foreground transition-colors">
                    {group.label}
                  </span>
                  <span className="text-xs text-muted-foreground/50">{count}</span>
                </button>
              </div>
            )}
            {!isCollapsed && (
              <div className="space-y-0">
                {groups[group.status]!.map((source) => (
                  <SourceListItem
                    key={source.id}
                    source={source}
                    collections={collections}
                    collectionsById={collectionsById}
                    tagsById={tagsById}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}


const STAGE_GROUPS: { status: string; label: string; dotColor: string }[] = [
  { status: "in_progress", label: "In progress",  dotColor: "bg-emerald-500" },
  { status: "reflecting",  label: "Reflecting",   dotColor: "bg-blue-500"   },
  { status: "todo",        label: "To do",        dotColor: "bg-slate-400"  },
  { status: "done",        label: "Done",         dotColor: "bg-amber-500"  },
];

function groupSourcesByStatus<
  T extends { status?: string; last_active_at?: string; updated_at?: string; created_at?: string }
>(sources: T[]): Partial<Record<string, T[]>> {
  const groups: Partial<Record<string, T[]>> = {};
  for (const source of sources) {
    const key = source.status ?? "todo";
    (groups[key] ??= []).push(source);
  }
  // Sort within each group by recency
  for (const key of Object.keys(groups)) {
    groups[key]!.sort((a, b) => getSourceSortTime(b) - getSourceSortTime(a));
  }
  return groups;
}


function getSourceSortTime(source: {
  last_active_at?: string;
  updated_at?: string;
  created_at?: string;
}) {
  return Date.parse(source.last_active_at ?? source.updated_at ?? source.created_at ?? "") || 0;
}
