"use client";

import { useDialog, useDialogStore } from "@/components/dialogs";
import { Button } from "@/components/ui/button";
import { CreateCaptureDialog } from "@/features/captures/components/create-capture-dialog";
import { CitationDialog } from "@/features/sources/dialogs/citation-dialog";
import { CreateSectionDialog } from "@/features/sources/dialogs/create-section-dialog";
import { useGroupedHighlights } from "@/features/sources/hooks/highlights";
import { useReorderSections, useSourceSections } from "@/features/sources/hooks/sections";
import { useSource } from "@/features/sources/hooks/sources";
import { flashElement } from "@/features/sources/pages/source-transcript-page-utils/flash-element";
import type { GroupedSection } from "@/features/sources/types";
import { useKeyboardShortcut } from "@/hooks/use-keyboard-shortcut";
import { routes } from "@/lib/routes";
import { Plus } from "lucide-react";
import { useRouter, useSearchParams } from "@/lib/nav";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { EmptyHighlightsState } from "@/features/sources/pages/source-highlights-page-components/empty-highlights-state";
import { HighlightsSkeleton } from "@/features/sources/pages/source-highlights-page-components/highlight-skeletons";
import { SectionGroup } from "@/features/sources/pages/source-highlights-page-components/section-group";
import { UnsortedSection } from "@/features/sources/pages/source-highlights-page-components/unsorted-section";
import { useRegisterSectionsSidebar } from "@/features/sources/components/source-sections-sidebar/store";

interface SourceHighlightsPageProps {
  sourceId: number;
}

function CreateButton({ sourceId }: { sourceId: number }) {
  const { data: source } = useSource(sourceId);
  const { openDialog } = useDialog();

  const handleCreateSection = useCallback(() => {
    if (!source) return;
    openDialog(CreateSectionDialog, { source });
  }, [source, openDialog]);

  return (
    <Button onClick={handleCreateSection} size="sm">
      <Plus className="h-4 w-4 mr-2" />
      Create Section
    </Button>
  );
}

// ─── Main tab ─────────────────────────────────────────────────────────────────

export function SourceHighlightsPage({ sourceId }: SourceHighlightsPageProps) {
  useRegisterSectionsSidebar(sourceId);
  const { data: source, isLoading: sourceLoading } = useSource(sourceId);
  const { data: grouped, isLoading: highlightsLoading } = useGroupedHighlights(sourceId);
  const { data: allSections = [], isLoading: sectionsLoading } = useSourceSections(sourceId);
  const reorderSections = useReorderSections(sourceId);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { openDialog } = useDialog();
  const dialogOpen = useDialogStore((state) => state.open);

  const [expandedSections, setExpandedSections] = useState<Set<number | string>>(new Set());
  const [hasInitializedExpanded, setHasInitializedExpanded] = useState(false);

  const isLoading = sourceLoading || highlightsLoading || sectionsLoading;

  // Initialize expanded sections when data first loads
  useEffect(() => {
    if (grouped && !hasInitializedExpanded) {
      const allSectionIds = new Set<number | string>();
      for (const s of grouped.sections) allSectionIds.add(s.section.id);
      const hasUnsorted = grouped.unsorted.citations.length > 0 || grouped.unsorted.captures.length > 0;
      if (hasUnsorted) allSectionIds.add("unsorted");
      setExpandedSections(allSectionIds);
      setHasInitializedExpanded(true);
    }
  }, [grouped, hasInitializedExpanded]);

  // Scroll to a highlight when quote/citation/capture parameter is present
  const scrolledToParamRef = useRef<string | null>(null);
  useEffect(() => {
    if (!hasInitializedExpanded) return;

    const quoteId = searchParams.get("quote") ?? searchParams.get("citation");
    const captureId = searchParams.get("capture");
    const targetId = quoteId
      ? `citation-${quoteId}`
      : captureId
      ? `capture-${captureId}`
      : null;
    if (!targetId || scrolledToParamRef.current === targetId) return;

    const element = document.getElementById(targetId);
    if (!element) return;

    scrolledToParamRef.current = targetId;
    element.scrollIntoView({ behavior: "smooth", block: "center" });
    flashElement(element);
  }, [searchParams, hasInitializedExpanded, grouped]);

  const toggleSection = useCallback((sectionId: number | string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      return next;
    });
  }, []);

  const handleAddQuote = useCallback((sectionId?: number, sectionTitle?: string) => {
    if (!source) return;
    openDialog(CitationDialog, { mode: "create", flow: "manual", sourceId: source.id!, sectionId, sectionTitle });
  }, [openDialog, source]);

  const handleAddCapture = useCallback((sectionId?: number, sectionTitle?: string) => {
    if (!source) return;
    openDialog(CreateCaptureDialog, { sourceId: source.id!, sourceTitle: source.title ?? undefined, sectionId, sectionTitle });
  }, [openDialog, source]);

  const handleReorderSection = useCallback((sectionId: number, direction: "up" | "down") => {
    const currentIndex = allSections.findIndex((s) => s.id === sectionId);
    if (currentIndex === -1) return;
    const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= allSections.length) return;
    const reordered = [...allSections];
    [reordered[currentIndex], reordered[targetIndex]] = [reordered[targetIndex], reordered[currentIndex]];
    reorderSections.mutate(reordered.map((s) => s.id), {
      onError: () => toast.error("Failed to reorder sections"),
    });
  }, [allSections, reorderSections]);

  const expandAll = useCallback(() => {
    if (!grouped) return;
    const allIds = new Set<number | string>();
    for (const s of grouped.sections) allIds.add(s.section.id);
    const hasUnsorted = grouped.unsorted.citations.length > 0 || grouped.unsorted.captures.length > 0;
    if (hasUnsorted) allIds.add("unsorted");
    setExpandedSections(allIds);
  }, [grouped]);

  const collapseAll = useCallback(() => setExpandedSections(new Set()), []);

  const allSectionIds = useMemo(() => {
    if (!grouped) return new Set<number | string>();
    const ids = new Set<number | string>();
    for (const s of grouped.sections) ids.add(s.section.id);
    const hasUnsorted = grouped.unsorted.citations.length > 0 || grouped.unsorted.captures.length > 0;
    if (hasUnsorted) ids.add("unsorted");
    return ids;
  }, [grouped]);

  const areAllExpanded = useMemo(() =>
    allSectionIds.size > 0 &&
    allSectionIds.size === expandedSections.size &&
    Array.from(allSectionIds).every((id) => expandedSections.has(id)),
    [allSectionIds, expandedSections]
  );

  const toggleCollapseAll = useCallback(() => {
    if (areAllExpanded) collapseAll(); else expandAll();
  }, [areAllExpanded, expandAll, collapseAll]);

  useKeyboardShortcut(() => toggleCollapseAll(), { key: "c", enabled: !dialogOpen });
  useKeyboardShortcut(() => toggleCollapseAll(), { key: "C", enabled: !dialogOpen });

  if (isLoading) return <HighlightsSkeleton />;
  if (!source || !grouped) return null;

  const hasUnsorted = grouped.unsorted.citations.length > 0 || grouped.unsorted.captures.length > 0;
  const isEmpty = grouped.totalCount === 0 && grouped.sections.length === 0;

  const handleEnterSectionView = (sectionId: number) => {
    router.push(routes.sourceSection(sourceId, sectionId));
  };

  const handleEnterUnsorted = () => {
    router.push(routes.sourceSectionUnsorted(sourceId));
  };

  return (
    <div className="space-y-6">
      {isEmpty && <EmptyHighlightsState sourceId={source.id!} />}

      {!isEmpty && (
        <>
          {/* Expand / Collapse all */}
          <div className="flex items-center gap-2">
            <button type="button" onClick={expandAll} className="text-sm text-muted-foreground hover:text-foreground cursor-pointer">
              Expand all
            </button>
            <span className="text-muted-foreground">·</span>
            <button type="button" onClick={collapseAll} className="text-sm text-muted-foreground hover:text-foreground cursor-pointer">
              Collapse all
            </button>
          </div>

          {/* Unsorted section */}
          {hasUnsorted && (
            <UnsortedSection
              citations={grouped.unsorted.citations}
              captures={grouped.unsorted.captures}
              sourceId={source.id!}
              isExpanded={expandedSections.has("unsorted")}
              onToggle={() => toggleSection("unsorted")}
              onAddQuote={() => handleAddQuote()}
              onAddCapture={() => handleAddCapture()}
              onEnterSectionView={handleEnterUnsorted}
            />
          )}

          {/* Section groups */}
          {grouped.sections.map((groupedSection: GroupedSection) => (
            <SectionGroup
              key={groupedSection.section.id}
              groupedSection={groupedSection}
              sourceId={source.id!}
              expandedSections={expandedSections}
              onToggle={toggleSection}
              onAddQuote={handleAddQuote}
              onAddCapture={handleAddCapture}
              onReorderSection={handleReorderSection}
              allSections={allSections}
              onEnterSectionView={handleEnterSectionView}
            />
          ))}
        </>
      )}
    </div>
  );
}

SourceHighlightsPage.CreateButton = CreateButton;
