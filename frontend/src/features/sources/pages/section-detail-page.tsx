"use client";

import { useDialogStore, useDialog } from "@/components/dialogs";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { PageHeader } from "@/components/layout/page-header";
import { ScrollToTopButton } from "@/components/layout/scroll-to-top-button";
import { Button } from "@/components/ui/button";

import { useSidebar } from "@/components/ui/sidebar";
import { CreateCaptureDialog } from "@/features/captures/components/create-capture-dialog";
import { SourceSectionsSidebarToggle } from "@/features/sources/components/source-sections-sidebar/source-sections-sidebar";
import { useRegisterSectionsSidebar } from "@/features/sources/components/source-sections-sidebar/store";
import { CitationDialog } from "@/features/sources/dialogs/citation-dialog";
import { CreateSectionDialog } from "@/features/sources/dialogs/create-section-dialog";
import { useGroupedHighlights } from "@/features/sources/hooks/highlights";
import { useReorderSections, useSourceSections } from "@/features/sources/hooks/sections";
import { SourceHeaderCondensed } from "@/features/sources/components/source-header-condensed";
import { SectionGroup } from "@/features/sources/pages/source-highlights-page-components/section-group";
import { UnsortedSection } from "@/features/sources/pages/source-highlights-page-components/unsorted-section";
import { flashElement } from "@/features/sources/pages/source-transcript-page-utils/flash-element";
import type { GroupedSection, SourceDTO } from "@/features/sources/types";
import { useKeyboardShortcut } from "@/hooks/use-keyboard-shortcut";
import { routes } from "@/lib/routes";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useRouter, useSearchParams } from "@/lib/nav";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

interface SectionDetailPageProps {
  source: SourceDTO;
  sourceId: number;
  sectionId: string; // numeric string or "unsorted"
}

export function SectionDetailPage({ source, sourceId, sectionId }: SectionDetailPageProps) {
  useRegisterSectionsSidebar(sourceId);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { openDialog } = useDialog();
  const dialogOpen = useDialogStore((state) => state.open);
  const { state: sidebarState } = useSidebar();

  const { data: grouped, isLoading: highlightsLoading } = useGroupedHighlights(sourceId);
  const { data: allSections = [], isLoading: sectionsLoading } = useSourceSections(sourceId);
  const reorderSections = useReorderSections(sourceId);

  const parsedSectionId: number | "unsorted" =
    sectionId === "unsorted" ? "unsorted" : parseInt(sectionId, 10);

  const [expandedSections, setExpandedSections] = useState<Set<number | string>>(new Set());
  const [hasInitializedExpanded, setHasInitializedExpanded] = useState(false);

  const isLoading = highlightsLoading || sectionsLoading;

  // Initialize expanded — only "unsorted" matters here since SectionGroup uses chapterView (always expanded)
  useEffect(() => {
    if (grouped && !hasInitializedExpanded) {
      const frame = window.requestAnimationFrame(() => {
        const hasUnsorted = grouped.unsorted.citations.length > 0 || grouped.unsorted.captures.length > 0;
        if (hasUnsorted) setExpandedSections(new Set<number | string>(["unsorted"]));
        setHasInitializedExpanded(true);
      });
      return () => window.cancelAnimationFrame(frame);
    }
  }, [grouped, hasInitializedExpanded]);

  const citationParam = searchParams.get("quote") ?? searchParams.get("citation");
  const captureParam = searchParams.get("capture");
  const targetElementId = citationParam
    ? `citation-${citationParam}`
    : captureParam
    ? `capture-${captureParam}`
    : null;

  // Scroll to highlight when citation/capture/quote param present
  useEffect(() => {
    if (!targetElementId || !hasInitializedExpanded) return;
    const element = document.getElementById(targetElementId);
    if (!element) return;
    element.scrollIntoView({ behavior: "smooth", block: "center" });
    flashElement(element);
  }, [targetElementId, hasInitializedExpanded, grouped]);

  const toggleSection = useCallback((id: number | string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleAddQuote = useCallback((secId?: number, secTitle?: string) => {
    openDialog(CitationDialog, {
      mode: "create",
      flow: "manual",
      sourceId: source.id!,
      sectionId: secId,
      sectionTitle: secTitle,
    });
  }, [openDialog, source]);

  const handleAddCapture = useCallback((secId?: number, secTitle?: string) => {
    openDialog(CreateCaptureDialog, {
      sourceId: source.id!,
      sourceTitle: source.title ?? undefined,
      sectionId: secId,
      sectionTitle: secTitle,
    });
  }, [openDialog, source]);

  const handleReorderSection = useCallback((secId: number, direction: "up" | "down") => {
    const currentIndex = allSections.findIndex((s) => s.id === secId);
    if (currentIndex === -1) return;
    const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= allSections.length) return;
    const reordered = [...allSections];
    [reordered[currentIndex], reordered[targetIndex]] = [reordered[targetIndex], reordered[currentIndex]];
    reorderSections.mutate(reordered.map((s) => s.id), {
      onError: () => toast.error("Failed to reorder sections"),
    });
  }, [allSections, reorderSections]);

  const hasUnsorted = useMemo(() =>
    (grouped?.unsorted.citations.length ?? 0) > 0 ||
    (grouped?.unsorted.captures.length ?? 0) > 0,
    [grouped]
  );

  // Nav order: unsorted first (if present), then sections in order
  const navOrder: Array<number | "unsorted"> = useMemo(() => [
    ...(hasUnsorted ? ["unsorted" as const] : []),
    ...(grouped?.sections.map((s: GroupedSection) => s.section.id as number) ?? []),
  ], [grouped, hasUnsorted]);

  const currentNavIndex = navOrder.indexOf(parsedSectionId);
  const prevId = currentNavIndex > 0 ? navOrder[currentNavIndex - 1] : null;
  const nextId = currentNavIndex < navOrder.length - 1 ? navOrder[currentNavIndex + 1] : null;

  const getNavLabel = (id: number | "unsorted") => {
    if (id === "unsorted") return "Unsorted";
    const section = grouped?.sections.find((s: GroupedSection) => s.section.id === id);
    return section?.section.title ?? "";
  };

  const navigateTo = useCallback((id: number | "unsorted") => {
    router.push(routes.sourceSection(sourceId, id));
  }, [router, sourceId]);

  // Current section data
  const currentGroupedSection = parsedSectionId !== "unsorted"
    ? grouped?.sections.find((s: GroupedSection) => s.section.id === parsedSectionId)
    : null;

  const currentSectionDTO = currentGroupedSection?.section;

  // Keyboard shortcuts: [ ] and ← → for prev/next
  useKeyboardShortcut(() => { if (prevId !== null) navigateTo(prevId); }, { key: "[", enabled: !dialogOpen });
  useKeyboardShortcut(() => { if (nextId !== null) navigateTo(nextId); }, { key: "]", enabled: !dialogOpen });
  useKeyboardShortcut(() => { if (prevId !== null) navigateTo(prevId); }, { key: "ArrowLeft", enabled: !dialogOpen, caseSensitive: true });
  useKeyboardShortcut(() => { if (nextId !== null) navigateTo(nextId); }, { key: "ArrowRight", enabled: !dialogOpen, caseSensitive: true });

  const handleCreateSection = useCallback(() => {
    const prefillRangeStart = currentSectionDTO?.range_end != null
      ? currentSectionDTO.range_end + 1
      : undefined;
    openDialog(CreateSectionDialog, {
      source,
      defaultRangeStart: prefillRangeStart,
      onSuccess: (newSection) => {
        router.push(routes.sourceSection(sourceId, newSection.id));
      },
    });
  }, [currentSectionDTO, openDialog, source, router, sourceId]);

  const sectionTitle = parsedSectionId === "unsorted"
    ? "Unsorted"
    : currentSectionDTO?.title ?? "Section";

  if (isLoading) {
    return (
      <>
        <PageHeader breadcrumbs={<Breadcrumbs items={[
          { label: "Library", href: "/library" },
          { label: source.title?.slice(0, 20) ?? "Source", href: `/library/${sourceId}?tab=highlights` },
          { label: "..." },
        ]} />} />
        <div className="container mx-auto px-4 pt-4 pb-8 flex justify-center items-center h-64">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted border-t-foreground" />
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
              { label: "Library", href: "/library" },
              {
                label: source.title
                  ? source.title.length > 20 ? `${source.title.slice(0, 20)}...` : source.title
                  : "Source",
                href: `/library/${sourceId}?tab=highlights`,
              },
              { label: sectionTitle.length > 24 ? `${sectionTitle.slice(0, 24)}...` : sectionTitle },
            ]}
          />
        }
        actions={<SourceSectionsSidebarToggle sourceId={sourceId} />}
      />

      <ScrollToTopButton />

      <div className="container mx-auto px-4 pt-2 md:pt-4 pb-32 space-y-4">
        {/* Condensed source header + section nav */}
        <div className="flex items-center justify-between gap-4">
          <SourceHeaderCondensed sourceId={sourceId} />

          <div className="flex items-center gap-3 shrink-0">
            <Button
              size="sm"
              variant="outline"
              onClick={handleCreateSection}
            >
              <Plus className="h-4 w-4 mr-1" />
              New Section
            </Button>
          </div>
        </div>

        {/* Section content */}
        {parsedSectionId === "unsorted" ? (
          grouped && hasUnsorted ? (
            <UnsortedSection
              citations={grouped.unsorted.citations}
              captures={grouped.unsorted.captures}
              sourceId={sourceId}
              isExpanded={expandedSections.has("unsorted")}
              onToggle={() => toggleSection("unsorted")}
              onAddQuote={() => handleAddQuote()}
              onAddCapture={() => handleAddCapture()}
              chapterView
            />
          ) : (
            <div className="py-12 text-center text-muted-foreground text-sm">
              No unsorted items
            </div>
          )
        ) : currentGroupedSection ? (
          <SectionGroup
            groupedSection={currentGroupedSection}
            sourceId={sourceId}
            expandedSections={expandedSections}
            onToggle={toggleSection}
            onAddQuote={handleAddQuote}
            onAddCapture={handleAddCapture}
            onReorderSection={handleReorderSection}
            allSections={allSections}
            chapterView
          />
        ) : (
          <div className="py-12 text-center text-muted-foreground text-sm">
            Section not found
          </div>
        )}
      </div>

      {/* Fixed bottom navigation */}
      <div
        className="fixed bottom-0 right-0 z-20 border-t border-border bg-background/95 backdrop-blur-sm transition-[left] duration-200 ease-linear"
        style={{ left: sidebarState === "collapsed" ? "3rem" : "16rem" }}
      >
        <div className="container mx-auto px-4 md:px-8 flex items-stretch">
          {/* Prev */}
          <button
            type="button"
            onClick={() => prevId !== null && navigateTo(prevId)}
            disabled={prevId === null}
            className="flex-1 flex flex-col items-start gap-0.5 px-4 py-3 hover:bg-muted/40 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors text-left border-r border-border"
          >
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <ChevronLeft className="h-3.5 w-3.5" /> Previous
              <span className="hidden sm:inline opacity-50">[←]</span>
            </span>
            <span className="text-sm font-medium truncate w-full">
              {prevId !== null ? getNavLabel(prevId) : "—"}
            </span>
          </button>

          {/* Next or New Section */}
          {nextId !== null ? (
            <button
              type="button"
              onClick={() => navigateTo(nextId)}
              className="flex-1 flex flex-col items-end gap-0.5 px-4 py-3 hover:bg-muted/40 cursor-pointer transition-colors text-right"
            >
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <span className="hidden sm:inline opacity-50">[→]</span>
                Next <ChevronRight className="h-3.5 w-3.5" />
              </span>
              <span className="text-sm font-medium truncate w-full">
                {getNavLabel(nextId)}
              </span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleCreateSection}
              className="flex-1 flex flex-col items-end gap-0.5 px-4 py-3 hover:bg-muted/40 cursor-pointer transition-colors text-right"
            >
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                New section <Plus className="h-3.5 w-3.5" />
              </span>
              <span className="text-sm font-medium text-muted-foreground">
                Add a section
              </span>
            </button>
          )}
        </div>
      </div>
    </>
  );
}
