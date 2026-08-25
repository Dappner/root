"use client";

import { useCollections } from "@/features/collections/hooks";
import { SourceListItem } from "@/features/sources/components/source-list-item";
import type { SourceDTO } from "@/features/sources/types";
import { useTags } from "@/features/tags/hooks";
import { useMemo } from "react";
import type { HomeRecentSource } from "../types";

type InProgressStripProps = {
  sources: HomeRecentSource[];
};

export function InProgressStrip({ sources }: InProgressStripProps) {
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
        tags.map((tag) => [tag.id, { id: tag.id, label: tag.label }]),
      ),
    [tags],
  );

  if (!sources || sources.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <h3 className="text-xl font-semibold tracking-tight">
        Recently Active
      </h3>
      <div className="space-y-4">
        {sources.map((item) => {
          if (!item.source) return null;
          return (
            <SourceListItem
              key={item.source.id}
              source={item.source as unknown as SourceDTO}
              collections={collections}
              collectionsById={collectionsById}
              tagsById={tagsById}
            />
          );
        })}
      </div>
    </div>
  );
}
