"use client";

import { useDialog } from "@/components/dialogs";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { CollectionsList } from "@/features/collections/components/collections-list";
import { CreateCollectionDialog } from "@/features/collections/dialogs/create-collection-dialog";
import { Layers, Plus } from "lucide-react";

export function CollectionsPage() {
  const { openDialog } = useDialog();

  return (
    <>
      <PageHeader breadcrumbs={<Breadcrumbs items={[{ label: "Collections" }]} />} />
      <div className="container mx-auto px-4 md:px-8 pt-4 pb-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Layers className="h-7 w-7" />
              <h1 className="text-3xl font-bold tracking-tight">Collections</h1>
            </div>
            <p className="text-muted-foreground mt-1.5">
              Organize your sources into groups like monthly newsletters, reading lists, and more.
            </p>
          </div>
          <Button
            onClick={() => openDialog(CreateCollectionDialog)}
            className="w-full md:w-auto"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Collection
          </Button>
        </div>

        {/* Collections List */}
        <CollectionsList />
      </div>
    </>
  );
}
