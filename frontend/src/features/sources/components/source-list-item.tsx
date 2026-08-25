"use client";

import { useDialog } from "@/components/dialogs";
import { Button } from "@/components/ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  CollectionChips,
  type CollectionChipCollection,
} from "@/features/collections/components/collection-chips";
import { openSourceCollectionPicker } from "@/features/collections/dialogs/source-collection-picker-dialog";
import { useAddSourceToCollection, useRemoveSourceFromCollection } from "@/features/collections/hooks";
import type { CollectionDTO } from "@/features/collections/types";
import { TagChips, type TagChipTag } from "@/features/tags/components/tag-chips";
import { timeAgo } from "@/lib/utils/date";
import { Archive, ArchiveRestore, BookOpen, CheckCheck, Layers, MessageSquare, MoreHorizontal, Pencil, Quote, Undo2 } from "lucide-react";
import { Link } from "@/lib/nav";
import { EditSourceDialog } from "../dialogs/edit-source-dialog";
import type { SourceDTO } from "../types";
import { SourceDTOStatus } from "../types";
import { buildMetadataBadges } from "../utils/metadata";
import { SourceIcon } from "./source-header/components/source-icon";
import { useTransitionSource } from "../hooks/sources";

interface SourceListItemProps {
  source: SourceDTO;
  collections?: CollectionDTO[];
  collectionsById?: Record<number, CollectionChipCollection | undefined>;
  tagsById?: Record<number, TagChipTag | undefined>;
}

export function SourceListItem({
  source,
  collections = [],
  collectionsById,
  tagsById,
}: SourceListItemProps) {
  const lastActive = source.last_active_at ? timeAgo(source.last_active_at) : null;
  const created = source.created_at ? timeAgo(source.created_at) : null;
  const badges = buildMetadataBadges(source);
  const { openDialog } = useDialog();
  const transitionSource = useTransitionSource();
  const addToCollection = useAddSourceToCollection();
  const removeFromCollection = useRemoveSourceFromCollection();

  const menuItemsProps = {
    source,
    openDialog,
    transitionSource,
    collections,
    addToCollection,
    removeFromCollection,
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger render={
        <div className="group py-4 -mx-4 px-4 rounded-lg hover:bg-accent/5 transition-all">
          <div className="flex items-start gap-5">
            <Link href={`/library/${source.id}`} className="shrink-0">
              {source.image_url ? (
                <div className="size-20 rounded-lg overflow-hidden border bg-secondary transition-all group-hover:shadow-lg">
                  <img
                    src={source.image_url}
                    alt={source.title}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>
              ) : (
                <div className="size-20 rounded-lg flex items-center justify-center bg-secondary/30 group-hover:bg-secondary/50 transition-colors">
                  <SourceIcon
                    type={source.type}
                    className="h-8 w-8 text-muted-foreground group-hover:text-primary transition-colors"
                  />
                </div>
              )}
            </Link>

            <Link href={`/library/${source.id}`} className="flex-1 min-w-0 space-y-2.5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-lg leading-snug group-hover:text-primary transition-colors">
                    {source.title}
                  </h3>
                  {badges.length > 0 && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1.5">
                      {badges.map((badge, index) => (
                        <span key={index} className="flex items-center gap-2">
                          {badge}
                          {index < badges.length - 1 && <span>•</span>}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                <div className="flex items-center gap-1.5">
                  <Quote className="size-3.5" />
                  <span>{source.citation_count}</span>
                </div>
                <span>•</span>
                <div className="flex items-center gap-1.5">
                  <MessageSquare className="size-3.5" />
                  <span>{source.capture_count}</span>
                </div>
                {(lastActive || created) && (
                  <>
                    <span>•</span>
                    <span className="text-muted-foreground/80">
                      {lastActive ? `Active ${lastActive}` : `Created ${created}`}
                    </span>
                  </>
                )}
                {source.status === "reflecting" && (
                  <>
                    <span>•</span>
                    <span className="text-muted-foreground/80">Reflecting</span>
                  </>
                )}
                {source.status === "done" && (
                  <>
                    <span>•</span>
                    <span className="text-muted-foreground/80">Done</span>
                  </>
                )}
                {source.tag_ids && source.tag_ids.length > 0 && (
                  <>
                    <span>•</span>
                    <TagChips
                      tagIds={source.tag_ids}
                      tagsById={tagsById}
                      className="flex items-center gap-1 flex-wrap"
                    />
                  </>
                )}
                {source.collection_ids && source.collection_ids.length > 0 && (
                  <>
                    <span>•</span>
                    <CollectionChips
                      collectionIds={source.collection_ids}
                      collectionsById={collectionsById}
                    />
                  </>
                )}
              </div>
            </Link>

            <div className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 self-center">
              <DropdownMenu>
                <DropdownMenuTrigger render={
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                }>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" side="bottom">
                  <SourceMenuItems
                    {...menuItemsProps}
                    ItemComponent={DropdownMenuItem}
                    SeparatorComponent={DropdownMenuSeparator}
                  />
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      }>
      </ContextMenuTrigger>

      <ContextMenuContent className="w-48">
        <SourceMenuItems
          {...menuItemsProps}
          ItemComponent={ContextMenuItem}
          SeparatorComponent={ContextMenuSeparator}
        />
      </ContextMenuContent>
    </ContextMenu>
  );
}

interface SourceMenuItemsProps {
  source: SourceDTO;
  openDialog: ReturnType<typeof useDialog>["openDialog"];
  transitionSource: ReturnType<typeof useTransitionSource>;
  collections: CollectionDTO[];
  addToCollection: ReturnType<typeof useAddSourceToCollection>;
  removeFromCollection: ReturnType<typeof useRemoveSourceFromCollection>;
  ItemComponent: typeof DropdownMenuItem;
  SeparatorComponent: typeof DropdownMenuSeparator;
}

function SourceMenuItems({
  source,
  openDialog,
  transitionSource,
  collections,
  addToCollection,
  removeFromCollection,
  ItemComponent,
  SeparatorComponent,
}: SourceMenuItemsProps) {
  const status = source.status;
  const goTo = (target: SourceDTOStatus) =>
    transitionSource.mutate({ id: source.id, status: target });
  return (
    <>
      <ItemComponent onClick={() => openDialog(EditSourceDialog, { source })}>
        <Pencil className="h-4 w-4" />
        Edit source
      </ItemComponent>
      <SeparatorComponent />
      {status === "todo" && (
        <ItemComponent onClick={() => goTo(SourceDTOStatus.in_progress)}>
          <BookOpen className="h-4 w-4" />
          Start
        </ItemComponent>
      )}
      {status === "in_progress" && (
        <>
          <ItemComponent onClick={() => goTo(SourceDTOStatus.reflecting)}>
            <Archive className="h-4 w-4" />
            Begin reflecting
          </ItemComponent>
          <ItemComponent onClick={() => goTo(SourceDTOStatus.todo)}>
            <Undo2 className="h-4 w-4" />
            Move back to to do
          </ItemComponent>
        </>
      )}
      {status === "reflecting" && (
        <>
          <ItemComponent onClick={() => goTo(SourceDTOStatus.done)}>
            <CheckCheck className="h-4 w-4" />
            Mark as done
          </ItemComponent>
          <ItemComponent onClick={() => goTo(SourceDTOStatus.in_progress)}>
            <Undo2 className="h-4 w-4" />
            Move back to in progress
          </ItemComponent>
        </>
      )}
      {status === "done" && (
        <ItemComponent onClick={() => goTo(SourceDTOStatus.reflecting)}>
          <ArchiveRestore className="h-4 w-4" />
          Move back to reflecting
        </ItemComponent>
      )}
      <SeparatorComponent />
      <ItemComponent
        onClick={() =>
          openSourceCollectionPicker({
            sourceId: source.id,
            collectionIds: source.collection_ids ?? [],
            collections,
            addToCollection: addToCollection.mutate,
            removeFromCollection: removeFromCollection.mutate,
            openDialog,
          })}
      >
        <Layers className="h-4 w-4" />
        Collections
      </ItemComponent>
    </>
  );
}
