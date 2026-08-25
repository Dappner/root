"use client";

import { useDialog, useDialogStore } from "@/components/dialogs";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { PodcastShowsGrid } from "@/features/podcasts/components/podcast-shows-grid";
import { SourcesList } from "@/features/sources/components/sources-list";
import { ImportPodcastDialog } from "@/features/sources/dialogs/import-podcast-dialog";
import { useKeyboardShortcut } from "@/hooks/use-keyboard-shortcut";
import { routes } from "@/lib/routes";
import { useRouter, useSearchParams } from "@/lib/nav";
import { Plus } from "lucide-react";

type ViewType = "browse" | "library";

function validateViewType(value: string | null): ViewType {
  return value === "library" ? "library" : "browse";
}

export function PodcastsPage() {
  const { openDialog } = useDialog();
  const searchParams = useSearchParams();
  const router = useRouter();
  const dialogOpen = useDialogStore((state) => state.open);
  const viewType = validateViewType(searchParams.get("view"));

  const setViewType = (view: ViewType) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", view);
    router.push(`${routes.discoverPodcasts}?${params.toString()}`);
  };

  useKeyboardShortcut(() => setViewType("browse"), { key: "b", enabled: !dialogOpen });
  useKeyboardShortcut(() => setViewType("library"), { key: "l", enabled: !dialogOpen });

  return (
    <>
      <PageHeader breadcrumbs={<Breadcrumbs items={[{ label: "Podcasts" }]} />} />
      <div className="container mx-auto px-4 md:px-8 pt-4 pb-8 space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Podcasts</h1>
            <p className="text-muted-foreground mt-1.5">Discover and manage podcast shows.</p>
          </div>
          <Button onClick={() => openDialog(ImportPodcastDialog)}>
            <Plus className="w-4 h-4 mr-2" />
            Syndicate Show
          </Button>
        </div>

        <div className="flex gap-2">
          <Button
            variant={viewType === "browse" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewType("browse")}
          >
            Browse Shows <span className="ml-1 text-xs opacity-50 hidden md:inline">[B]</span>
          </Button>
          <Button
            variant={viewType === "library" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewType("library")}
          >
            My Library <span className="ml-1 text-xs opacity-50 hidden md:inline">[L]</span>
          </Button>
        </div>

        {viewType === "browse" ? <PodcastShowsGrid /> : <SourcesList type="podcast" />}
      </div>
    </>
  );
}
