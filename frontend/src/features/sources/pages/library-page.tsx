"use client";

import { useDialogStore } from "@/components/dialogs";
import { useDialog } from "@/components/dialogs";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { SourcesList } from "@/features/sources/components/sources-list";
import { CreateSourceDialog } from "@/features/sources/dialogs/create-source-dialog";
import { useSources } from "@/features/sources/hooks/sources";
import type { SourceType } from "@/features/sources/types";
import { useKeyboardShortcut } from "@/hooks/use-keyboard-shortcut";
import { LOCAL_STORAGE_KEYS, useLocalStorage } from "@/hooks/use-local-storage";
import { Plus, Search } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "@/lib/nav";
import { useEffect, useState } from "react";

const SOURCE_TYPES = [
  { value: "", label: "All" },
  { value: "book", label: "Books" },
  { value: "article", label: "Articles" },
  { value: "video", label: "Videos" },
  { value: "podcast", label: "Podcasts" },
  { value: "pdf", label: "PDFs" },
] as const;

const VALID_SOURCE_TYPES: SourceType[] = ["book", "article", "video", "podcast", "pdf"];

function validateSourceType(type: string | null): SourceType | undefined {
  if (!type) return undefined;
  return VALID_SOURCE_TYPES.includes(type as SourceType) ? (type as SourceType) : undefined;
}

export function LibraryPage() {
  const { openDialog } = useDialog();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const dialogOpen = useDialogStore((state) => state.open);
  const rawType = searchParams.get("type");
  const validatedType = validateSourceType(rawType);
  const statusFilter = searchParams.get("status") ?? undefined;
  const [hideInCollections, setHideInCollections] = useLocalStorage(LOCAL_STORAGE_KEYS.SOURCES_HIDE_IN_COLLECTIONS, false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (rawType && !validatedType) {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("type");
      router.replace(`${pathname}?${params.toString()}`);
    }
  }, [rawType, validatedType, pathname, router, searchParams]);

  const selectedType = validatedType || "";
  const { data: sourceListResponse, isLoading: countsLoading } = useSources();
  const counts = sourceListResponse?.metadata?.counts;
  const hasAnySources = counts && (counts.all ?? 0) > 0;

  const updateFilter = (type: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (type) {
      params.set("type", type);
    } else {
      params.delete("type");
    }
    router.push(`${pathname}?${params.toString()}`);
  };

  useKeyboardShortcut(() => { updateFilter(""); }, { key: "a", enabled: !dialogOpen });
  useKeyboardShortcut(() => { updateFilter("book"); }, { key: "b", enabled: !dialogOpen });
  useKeyboardShortcut(() => { updateFilter("article"); }, { key: "r", enabled: !dialogOpen });
  useKeyboardShortcut(() => { updateFilter("video"); }, { key: "v", enabled: !dialogOpen });
  useKeyboardShortcut(() => { updateFilter("podcast"); }, { key: "p", enabled: !dialogOpen });
  useKeyboardShortcut(() => { updateFilter("pdf"); }, { key: "d", enabled: !dialogOpen });

  const getCountForType = (type: string): number => {
    if (!counts) return 0;
    if (type === "") return counts.all ?? 0;
    return counts[type as keyof typeof counts] || 0;
  };

  return (
    <>
      <PageHeader breadcrumbs={<Breadcrumbs items={[{ label: "Library" }]} />} />
      <div className="container mx-auto px-4 md:px-8 pt-4 pb-8 space-y-6">
        <div className="flex flex-col md:flex-row items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Library</h1>
            <p className="text-muted-foreground mt-1.5">
              Your personal collection of books, articles, videos, podcasts, and PDFs.
            </p>
          </div>
          <div className="flex gap-2 w-full md:w-auto">
            <Button
              onClick={() => openDialog(CreateSourceDialog, { defaultType: "book" })}
              className="flex-1 md:flex-none"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Source
            </Button>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search library..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 max-w-sm"
          />
        </div>

        <div className={`flex gap-2 flex-wrap transition-opacity duration-300 ${!hasAnySources ? "opacity-40" : "opacity-100"}`}>
          {SOURCE_TYPES.map(({ value, label }) => {
            const shortcut = value === "" ? "A" : value === "book" ? "B" : value === "article" ? "R" : value === "video" ? "V" : value === "podcast" ? "P" : value === "pdf" ? "D" : null;
            return (
              <Button
                key={value}
                variant={selectedType === value ? "default" : "outline"}
                size="sm"
                onClick={() => updateFilter(value)}
                disabled={countsLoading}
                className="gap-2"
              >
                {label} {counts && !countsLoading && `(${getCountForType(value)})`}
                {shortcut && (
                  <span className={`ml-1 text-xs hidden md:inline ${selectedType === value ? "text-primary-foreground/50" : "text-muted-foreground"}`}>[{shortcut}]</span>
                )}
              </Button>
            );
          })}
          <label className="ml-1 flex h-9 items-center gap-2 px-1 text-sm text-muted-foreground">
            <Checkbox
              checked={hideInCollections}
              onCheckedChange={(checked) => setHideInCollections(checked === true)}
              disabled={countsLoading || !hasAnySources}
            />
            <span>Hide in collections</span>
          </label>
        </div>

        <SourcesList type={validatedType} statusFilter={statusFilter} hideInCollections={hideInCollections} search={search} />
      </div>
    </>
  );
}
