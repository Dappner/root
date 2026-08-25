"use client";

import { timeAgo } from "@/lib/utils/date";
import { Layers } from "lucide-react";
import { Link } from "@/lib/nav";
import type { CollectionDTO } from "../types";

interface CollectionListItemProps {
  collection: CollectionDTO;
}

export function CollectionListItem({ collection }: CollectionListItemProps) {
  const updatedAt = collection.updated_at ? timeAgo(collection.updated_at) : null;

  return (
    <Link href={`/library/collections/${collection.id}`}>
      <div className="group py-4 border-b last:border-b-0 transition-all hover:bg-accent/5 -mx-4 px-4 rounded-lg">
        <div className="flex items-start gap-5">
          <div className="size-16 shrink-0 rounded-lg flex items-center justify-center bg-secondary/30 group-hover:bg-secondary/50 transition-colors">
            <Layers className="h-7 w-7 text-muted-foreground group-hover:text-primary transition-colors" />
          </div>
          <div className="flex-1 min-w-0 space-y-1.5">
            <h3 className="font-semibold text-lg leading-snug group-hover:text-primary transition-colors">
              {collection.name}
            </h3>
            {collection.description && (
              <p className="text-sm text-muted-foreground line-clamp-2">{collection.description}</p>
            )}
            <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
              <span>{collection.source_count} {collection.source_count === 1 ? "source" : "sources"}</span>
              {updatedAt && (
                <>
                  <span>•</span>
                  <span>Updated {updatedAt}</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
