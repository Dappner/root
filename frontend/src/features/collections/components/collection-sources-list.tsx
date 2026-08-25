"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCollections } from "@/features/collections/hooks";
import { SourceListItem } from "@/features/sources/components/source-list-item";
import { useSources } from "@/features/sources/hooks/sources";
import { useTags } from "@/features/tags/hooks";
import { LOCAL_STORAGE_KEYS, useLocalStorage } from "@/hooks/use-local-storage";
import { useMemo } from "react";
import { useCollectionSourceIDs } from "../hooks";

type CollectionSortOption = "publication_date" | "date_added" | "title";

const SORT_OPTIONS: { value: CollectionSortOption; label: string }[] = [
  { value: "publication_date", label: "Publication date" },
  { value: "date_added", label: "Date added" },
  { value: "title", label: "Title" },
];

interface CollectionSourcesListProps {
  collectionId: number;
}

export function CollectionSourcesList({ collectionId }: CollectionSourcesListProps) {
  const { data: sourceIDsDTO, isLoading: idsLoading } = useCollectionSourceIDs(collectionId);
  const { data: sourcesListResponse, isLoading: sourcesLoading } = useSources();
  const { data: collections = [] } = useCollections();
  const { data: tags = [] } = useTags();
  const [sort, setSort] = useLocalStorage<CollectionSortOption>(LOCAL_STORAGE_KEYS.COLLECTION_SORT, "publication_date");

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
        tags.map((tag) => [tag.id, { id: tag.id, label: tag.label }]),
      ),
    [tags],
  );

  const sourceIdSet = useMemo(() => new Set(sourceIDsDTO?.source_ids ?? []), [sourceIDsDTO?.source_ids]);

  const collectionSources = useMemo(() => {
    const allSources = sourcesListResponse?.sources ?? [];
    const filtered = allSources.filter((s) => sourceIdSet.has(s.id));
    return [...filtered].sort((a, b) => {
      if (sort === "publication_date") {
        const aDate = a.published_at ? new Date(a.published_at).getTime() : 0;
        const bDate = b.published_at ? new Date(b.published_at).getTime() : 0;
        // Sources without a publication date fall to the end
        if (aDate === 0 && bDate === 0) return 0;
        if (aDate === 0) return 1;
        if (bDate === 0) return -1;
        return bDate - aDate;
      }
      if (sort === "date_added") {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      if (sort === "title") {
        return (a.title ?? "").localeCompare(b.title ?? "");
      }
      return 0;
    });
  }, [sourcesListResponse?.sources, sourceIdSet, sort]);

  const isLoading = idsLoading || sourcesLoading;

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="py-4 border-b last:border-b-0 animate-pulse">
            <div className="flex items-start gap-5">
              <div className="size-20 rounded-lg bg-secondary/50" />
              <div className="flex-1 space-y-2">
                <div className="h-5 bg-secondary/50 rounded w-1/3" />
                <div className="h-3 bg-secondary/50 rounded w-2/3" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (collectionSources.length === 0) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        <p>No sources in this collection yet.</p>
        <p className="text-sm mt-1">Add sources by clicking &ldquo;Add Source to Collection&rdquo; below.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-end mb-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Sort by</span>
          <Select items={SORT_OPTIONS} value={sort} onValueChange={(v) => setSort(v as CollectionSortOption)}>
            <SelectTrigger className="h-8 w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      {collectionSources.map((source) => (
        <SourceListItem
          key={source.id}
          source={source}
          collections={collections}
          collectionsById={collectionsById}
          tagsById={tagsById}
        />
      ))}
    </div>
  );
}
