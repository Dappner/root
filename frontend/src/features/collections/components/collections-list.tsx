"use client";

import { useCollections } from "../hooks";
import { CollectionListItem } from "./collection-list-item";
import { CollectionsEmptyState } from "./collections-empty-state";

export function CollectionsList() {
  const { data: collections, isLoading } = useCollections();

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="py-4 border-b last:border-b-0 animate-pulse">
            <div className="flex items-start gap-5">
              <div className="size-16 rounded-lg bg-secondary/50" />
              <div className="flex-1 space-y-2">
                <div className="h-5 bg-secondary/50 rounded w-1/3" />
                <div className="h-3 bg-secondary/50 rounded w-2/3" />
                <div className="h-3 bg-secondary/50 rounded w-1/4" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!collections || collections.length === 0) {
    return <CollectionsEmptyState />;
  }

  return (
    <div>
      {collections.map((collection) => (
        <CollectionListItem key={collection.id} collection={collection} />
      ))}
    </div>
  );
}
