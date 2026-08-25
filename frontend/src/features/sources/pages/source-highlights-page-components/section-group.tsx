"use client";
import { useDialog } from "@/components/dialogs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { DeleteSectionDialog } from "@/features/sources/dialogs/delete-section-dialog";
import { EditSectionDialog } from "@/features/sources/dialogs/edit-section-dialog";
import { useUpdateSection } from "@/features/sources/hooks/sections";
import { useSource } from "@/features/sources/hooks/sources";
import { HighlightItem } from "@/features/sources/pages/source-highlights-page-components/highlight-item";
import type { GroupedSection, SourceSectionDTO } from "@/features/sources/types";
import { formatSectionRange } from "@/features/sources/utils/section-ranges";
import { ChevronDown, ChevronRight, Ellipsis, ExternalLink, MessageSquarePlus, Pencil, Quote } from "lucide-react";
import { memo, useMemo, useState } from "react";
import { toast } from "sonner";
import { CaptureItem } from "./capture-item-card";
import {
  SectionMenuItems,
} from "./section-menu-items";
import { SectionSummary } from "./section-summary";

interface SectionGroupProps {
  groupedSection: GroupedSection;
  sourceId: number;
  expandedSections: Set<number | string>;
  onToggle: (sectionId: number | string) => void;
  onAddQuote: (sectionId: number, sectionTitle: string) => void;
  onAddCapture: (sectionId: number, sectionTitle: string) => void;
  onReorderSection: (sectionId: number, direction: "up" | "down") => void;
  allSections: SourceSectionDTO[];
  onEnterSectionView?: (sectionId: number) => void;
  chapterView?: boolean;
}

export const SectionGroup = memo(function SectionGroup({
  groupedSection,
  sourceId,
  expandedSections,
  onToggle,
  onAddQuote,
  onAddCapture,
  onReorderSection,
  allSections,
  onEnterSectionView,
  chapterView = false,
}: SectionGroupProps) {
  const { section, citations, captures } = groupedSection;
  const expanded = chapterView || expandedSections.has(section.id);
  const hasContent = citations.length > 0 || captures.length > 0;
  const { openDialog } = useDialog();
  const { data: source } = useSource(sourceId);
  const updateSection = useUpdateSection(sourceId, section.id);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(section.title);

  // Memoize range label to avoid recalculation
  const rangeLabel = useMemo(
    () => formatSectionRange(source, section.range_start, section.range_end),
    [source, section.range_start, section.range_end]
  );

  const { isFirstSibling, isLastSibling } = useMemo(() => {
    const siblingIndex = allSections.findIndex((s) => s.id === section.id);
    return {
      isFirstSibling: siblingIndex === 0,
      isLastSibling: siblingIndex === allSections.length - 1,
    };
  }, [allSections, section.id]);

  // Menu actions
  const handleEdit = () => {
    openDialog(EditSectionDialog, { sourceId, section });
  };

  const handleDelete = () => {
    openDialog(DeleteSectionDialog, {
      sourceId,
      sectionId: section.id,
      sectionTitle: section.title,
    });
  };

  const handleMoveUp = () => {
    if (!isFirstSibling) {
      onReorderSection(section.id, "up");
    }
  };

  const handleMoveDown = () => {
    if (!isLastSibling) {
      onReorderSection(section.id, "down");
    }
  };

  const handleAddQuote = () => {
    onAddQuote(section.id, section.title);
  };

  const handleAddCapture = () => {
    onAddCapture(section.id, section.title);
  };

  const startEditingTitle = () => {
    setTitleDraft(section.title);
    setIsEditingTitle(true);
  };

  const handleTitleSave = () => {
    const nextTitle = titleDraft.trim();
    if (!nextTitle) {
      setTitleDraft(section.title);
      setIsEditingTitle(false);
      return;
    }
    if (nextTitle === section.title) {
      setIsEditingTitle(false);
      return;
    }

    updateSection.mutate(
      {
        title: nextTitle,
        summary: section.summary,
        range_start: section.range_start,
        range_end: section.range_end,
      },
      {
        onError: () => {
          toast.error("Failed to save section title");
          setTitleDraft(section.title);
        },
      }
    );
    setIsEditingTitle(false);
  };

  const menuItemsProps = {
    section,
    isFirstSibling,
    isLastSibling,
    allSections,
    sourceId,
    onEdit: handleEdit,
    onDelete: handleDelete,
    onMoveUp: handleMoveUp,
    onMoveDown: handleMoveDown,
    onAddQuote: handleAddQuote,
    onAddCapture: handleAddCapture,
  };

  const titleInput = isEditingTitle ? (
    <Input
      value={titleDraft}
      onChange={(e) => setTitleDraft(e.target.value)}
      onBlur={handleTitleSave}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === "Enter") { e.preventDefault(); handleTitleSave(); }
        if (e.key === "Escape") { e.preventDefault(); setTitleDraft(section.title); setIsEditingTitle(false); }
      }}
      className="h-8 max-w-sm"
      autoFocus
    />
  ) : null;

  const dropdownMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger render={
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={(e) => e.stopPropagation()}>
          <Ellipsis className="h-4 w-4" />
          <span className="sr-only">Section options</span>
        </Button>
      } />
      <DropdownMenuContent align="end" className="w-48">
        <SectionMenuItems {...menuItemsProps} ItemComponent={DropdownMenuItem} SeparatorComponent={DropdownMenuSeparator} />
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const sectionContent = (
    <>
      {hasContent ? (
        <>
          {citations.length > 0 && (
            <div className="space-y-3">
              {citations.map((cwc) => (
                <HighlightItem key={cwc.citation.id} citationWithCapture={cwc} sourceId={sourceId} currentSectionId={section.id} />
              ))}
            </div>
          )}
          {captures.length > 0 && (
            <div className="space-y-3">
              {captures.map((cap) => (
                <CaptureItem key={cap.id} capture={cap} sourceId={sourceId} currentSectionId={section.id} />
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="py-8 text-center text-sm text-muted-foreground">
          <p>No highlights in this section yet</p>
        </div>
      )}
    </>
  );

  if (chapterView) {
    return (
      <div className="space-y-6">
        {/* Document-style header */}
        <ContextMenu>
          <ContextMenuTrigger render={
            <div className="group space-y-1">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {isEditingTitle ? titleInput : (
                      <>
                        <h2
                          className="text-2xl font-bold cursor-text"
                          onDoubleClick={(e) => { e.stopPropagation(); startEditingTitle(); }}
                        >
                          {section.title}
                        </h2>
                        <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => { e.stopPropagation(); startEditingTitle(); }} aria-label="Edit section title">
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    )}
                  </div>
                  {section.subtitle && (
                    <p className="text-sm text-muted-foreground">
                      {section.subtitle}
                    </p>
                  )}
                  {rangeLabel && <p className="text-sm text-muted-foreground mt-0.5">{rangeLabel}</p>}
                  <div className="mt-2">
                    <SectionSummary sourceId={sourceId} section={section} />
                  </div>
                </div>
                <div className="mt-1 flex shrink-0 items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 text-xs"
                    onClick={(e) => { e.stopPropagation(); handleAddQuote(); }}
                    title="Add citation"
                  >
                    <Quote className="h-3.5 w-3.5 mr-1" />
                    Citation
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 text-xs"
                    onClick={(e) => { e.stopPropagation(); handleAddCapture(); }}
                    title="Add comment"
                  >
                    <MessageSquarePlus className="h-3.5 w-3.5 mr-1" />
                    Comment
                  </Button>
                  {dropdownMenu}
                </div>
              </div>
            </div>
          } />
          <ContextMenuContent className="w-48">
            <SectionMenuItems {...menuItemsProps} ItemComponent={ContextMenuItem} SeparatorComponent={ContextMenuSeparator} />
          </ContextMenuContent>
        </ContextMenu>

        <div className="h-px bg-border" />

        {sectionContent}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Section Header with Context Menu */}
      <ContextMenu>
        <ContextMenuTrigger render={
          <div className="group rounded-md p-3 bg-muted/40 hover:bg-muted/60 border border-muted transition-colors">
            {/* Desktop: Horizontal layout */}
            <div className="hidden md:flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 flex-1">
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => onToggle(section.id)} aria-label={expanded ? "Collapse section" : "Expand section"}>
                  {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </Button>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    {isEditingTitle ? titleInput : (
                      <>
                        <h3 className="text-lg font-semibold cursor-text" onDoubleClick={(e) => { e.stopPropagation(); startEditingTitle(); }}>
                          {section.title}
                        </h3>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); startEditingTitle(); }} aria-label="Edit section title">
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        {onEnterSectionView && (
                          <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => { e.stopPropagation(); onEnterSectionView(section.id); }} aria-label="View section">
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </>
                    )}
                    {(citations.length > 0 || captures.length > 0) && (
                      <span className="text-xs text-muted-foreground">
                        ({citations.length} {citations.length === 1 ? "quote" : "quotes"}, {captures.length} {captures.length === 1 ? "comment" : "comments"})
                      </span>
                    )}
                  </div>
                  {section.subtitle && (
                    <div className="text-sm text-muted-foreground">
                      {section.subtitle}
                    </div>
                  )}
                  {rangeLabel && <div className="text-sm text-muted-foreground">{rangeLabel}</div>}
                  <SectionSummary sourceId={sourceId} section={section} />
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 text-xs"
                  onClick={(e) => { e.stopPropagation(); handleAddQuote(); }}
                  title="Add citation"
                >
                  <Quote className="h-3.5 w-3.5 mr-1" />
                  Citation
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 text-xs"
                  onClick={(e) => { e.stopPropagation(); handleAddCapture(); }}
                  title="Add comment"
                >
                  <MessageSquarePlus className="h-3.5 w-3.5 mr-1" />
                  Comment
                </Button>
                {dropdownMenu}
              </div>
            </div>

            {/* Mobile: Stacked layout */}
            <div className="md:hidden space-y-2">
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => onToggle(section.id)} aria-label={expanded ? "Collapse section" : "Expand section"}>
                  {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                </Button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {isEditingTitle ? titleInput : (
                      <>
                        <h3 className="text-base font-semibold cursor-text" onDoubleClick={(e) => { e.stopPropagation(); startEditingTitle(); }}>
                          {section.title}
                        </h3>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); startEditingTitle(); }} aria-label="Edit section title">
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    )}
                    {(citations.length > 0 || captures.length > 0) && (
                      <span className="text-[10px] text-muted-foreground">
                        ({citations.length} {citations.length === 1 ? "quote" : "quotes"}, {captures.length} {captures.length === 1 ? "comment" : "comments"})
                      </span>
                    )}
                  </div>
                  {section.subtitle && (
                    <div className="text-xs text-muted-foreground">
                      {section.subtitle}
                    </div>
                  )}
                  {rangeLabel && <div className="text-xs text-muted-foreground">{rangeLabel}</div>}
                  <SectionSummary sourceId={sourceId} section={section} />
                </div>
              </div>
              <div className="flex items-center gap-1 ml-9">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={(e) => { e.stopPropagation(); handleAddQuote(); }}
                  title="Add citation"
                >
                  <Quote className="h-3 w-3 mr-1" />
                  Citation
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={(e) => { e.stopPropagation(); handleAddCapture(); }}
                  title="Add comment"
                >
                  <MessageSquarePlus className="h-3 w-3 mr-1" />
                  Comment
                </Button>
                {dropdownMenu}
              </div>
            </div>
          </div>
        }>
        </ContextMenuTrigger>

        <ContextMenuContent className="w-48">
          <SectionMenuItems {...menuItemsProps} ItemComponent={ContextMenuItem} SeparatorComponent={ContextMenuSeparator} />
        </ContextMenuContent>
      </ContextMenu>

      <div className="h-px bg-border" />

      {expanded && sectionContent}
    </div>
  );
});
