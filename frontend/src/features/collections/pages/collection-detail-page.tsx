"use client";

import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { CollectionSourcesList } from "@/features/collections/components/collection-sources-list";
import { openAddSourceToCollectionPicker } from "@/features/collections/dialogs/add-source-to-collection-dialog";
import { DeleteCollectionDialog } from "@/features/collections/dialogs/delete-collection-dialog";
import { EditCollectionDialog } from "@/features/collections/dialogs/edit-collection-dialog";
import { useAddSourceToCollection, useCollection, useCollectionSourceIDs } from "@/features/collections/hooks";
import { useSources } from "@/features/sources/hooks/sources";
import { useDialog } from "@/components/dialogs";
import { Layers, Pencil, Plus, Trash2 } from "lucide-react";

interface CollectionDetailPageProps {
  collectionId: number;
}

export function CollectionDetailPage({ collectionId }: CollectionDetailPageProps) {
  const id = collectionId;
  const { openDialog } = useDialog();
  const { data: collection, isLoading } = useCollection(id);
  const { data: sourcesListResponse } = useSources();
  const { data: sourceIDsDTO } = useCollectionSourceIDs(id);
  const addSource = useAddSourceToCollection();

  const allSources = sourcesListResponse?.sources ?? [];
  const existingSourceIds = new Set(sourceIDsDTO?.source_ids ?? []);
  const availableSources = allSources.filter((s) => !existingSourceIds.has(s.id));

  if (isLoading) {
    return (
      <>
        <PageHeader breadcrumbs={<Breadcrumbs items={[{ label: "Collections", href: "/library/collections" }, { label: "..." }]} />} />
        <div className="container mx-auto px-4 md:px-8 pt-4 pb-8">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-secondary/50 rounded w-1/3" />
            <div className="h-4 bg-secondary/50 rounded w-1/2" />
          </div>
        </div>
      </>
    );
  }

  if (!collection) {
    return (
      <>
        <PageHeader breadcrumbs={<Breadcrumbs items={[{ label: "Collections", href: "/library/collections" }, { label: "Not Found" }]} />} />
        <div className="container mx-auto px-4 md:px-8 pt-4 pb-8">
          <p className="text-muted-foreground">Collection not found.</p>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        breadcrumbs={
          <Breadcrumbs
            items={[
              { label: "Collections", href: "/library/collections" },
              { label: collection.name },
            ]}
          />
        }
      />
      <div className="container mx-auto px-4 md:px-8 pt-4 pb-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Layers className="h-7 w-7" />
              <h1 className="text-3xl font-bold tracking-tight">{collection.name}</h1>
            </div>
            {collection.description && (
              <p className="text-muted-foreground mt-1.5">{collection.description}</p>
            )}
            <p className="text-sm text-muted-foreground mt-1">
              {collection.source_count} {collection.source_count === 1 ? "source" : "sources"}
            </p>
          </div>
          <div className="flex gap-2 w-full md:w-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={() => openDialog(EditCollectionDialog, { collection })}
            >
              <Pencil className="w-4 h-4 mr-2" />
              Edit
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => openDialog(DeleteCollectionDialog, { collection })}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </Button>
            <Button
              onClick={() => openAddSourceToCollectionPicker({
                collectionId: id,
                availableSources,
                addSource: addSource.mutateAsync,
              })}
              className="flex-1 md:flex-none"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Source to Collection
            </Button>
          </div>
        </div>

        {/* Sources List */}
        <CollectionSourcesList collectionId={id} />
      </div>
    </>
  );
}
