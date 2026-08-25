"use client";

import { Button } from "@/components/ui/button";
import type { CaptureDTO } from "@/features/captures/types";
import { CitationWithCapture } from "@/features/sources/types";
import { ChevronDown, ChevronRight, ExternalLink, MessageSquarePlus, Quote } from "lucide-react";
import { memo } from "react";
import { CaptureItem } from "./capture-item-card";
import { HighlightItem } from "./highlight-item";

interface UnsortedSectionProps {
  citations: CitationWithCapture[];
  captures: CaptureDTO[];
  sourceId: number;
  isExpanded: boolean;
  onToggle: () => void;
  onAddQuote: () => void;
  onAddCapture: () => void;
  onEnterSectionView?: () => void;
  /**
   * When true, the page-level header already shows the "Unsorted" title and
   * description, so we skip the card-shell header to avoid duplication.
   * Content is always expanded. Add-quote / add-note actions render inline
   * since the page header doesn't provide them. Mirrors `SectionGroup`'s
   * chapterView prop.
   */
  chapterView?: boolean;
}

export const UnsortedSection = memo(function UnsortedSection({
  citations,
  captures,
  sourceId,
  isExpanded,
  onToggle,
  onAddQuote,
  onAddCapture,
  onEnterSectionView,
  chapterView = false,
}: UnsortedSectionProps) {
  if (citations.length === 0 && captures.length === 0) return null;

  const expanded = chapterView || isExpanded;

  if (chapterView) {
    return (
      <div className="space-y-6">
        {/* Document-style header — title/subtitle on the left, add actions on the right */}
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1 min-w-0">
            <h2 className="text-2xl font-bold">Unsorted</h2>
            <p className="text-sm text-muted-foreground">Items without a section</p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-xs"
              onClick={onAddQuote}
              title="Add citation"
            >
              <Quote className="h-3.5 w-3.5 mr-1" />
              Citation
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-xs"
              onClick={onAddCapture}
              title="Add comment"
            >
              <MessageSquarePlus className="h-3.5 w-3.5 mr-1" />
              Comment
            </Button>
          </div>
        </div>

        <div className="h-px bg-border" />

        <div className="space-y-3">
          {citations.map((cwc) => (
            <HighlightItem
              key={cwc.citation.id}
              citationWithCapture={cwc}
              sourceId={sourceId}
            />
          ))}
          {captures.map((cap) => (
            <CaptureItem
              key={cap.id}
              capture={cap}
              sourceId={sourceId}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="group rounded-md p-3 bg-muted/40 hover:bg-muted/60 border border-muted transition-colors">
        {/* Desktop: Horizontal layout */}
        <div className="hidden md:flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={onToggle}
              aria-label={isExpanded ? "Collapse section" : "Expand section"}
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold">Unsorted</h3>
                {onEnterSectionView && (
                  <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => { e.stopPropagation(); onEnterSectionView(); }} aria-label="View unsorted">
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Button>
                )}
                <span className="text-xs text-muted-foreground">
                  ({citations.length} {citations.length === 1 ? "quote" : "quotes"}, {captures.length} {captures.length === 1 ? "comment" : "comments"})
                </span>
              </div>
              <div className="text-sm text-muted-foreground">
                Items without a section
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-xs"
              onClick={(e) => {
                e.stopPropagation();
                onAddQuote();
              }}
              title="Add citation"
            >
              <Quote className="h-3.5 w-3.5 mr-1" />
              Citation
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-xs"
              onClick={(e) => {
                e.stopPropagation();
                onAddCapture();
              }}
              title="Add comment"
            >
              <MessageSquarePlus className="h-3.5 w-3.5 mr-1" />
              Comment
            </Button>
          </div>
        </div>

        {/* Mobile: Stacked layout */}
        <div className="md:hidden space-y-2">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0"
              onClick={onToggle}
              aria-label={isExpanded ? "Collapse section" : "Expand section"}
            >
              {isExpanded ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
            </Button>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h3 className="text-base font-semibold">Unsorted</h3>
                <span className="text-[10px] text-muted-foreground">
                  ({citations.length} {citations.length === 1 ? "quote" : "quotes"}, {captures.length} {captures.length === 1 ? "comment" : "comments"})
                </span>
              </div>
              <div className="text-xs text-muted-foreground">
                Items without a section
              </div>
            </div>
          </div>

          {/* Buttons below on mobile */}
          <div className="flex items-center gap-1 ml-9">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={(e) => {
                e.stopPropagation();
                onAddQuote();
              }}
              title="Add citation"
            >
              <Quote className="h-3 w-3 mr-1" />
              Citation
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={(e) => {
                e.stopPropagation();
                onAddCapture();
              }}
              title="Add comment"
            >
              <MessageSquarePlus className="h-3 w-3 mr-1" />
              Comment
            </Button>
          </div>
        </div>
      </div>

      <div className="h-px bg-border" />

      {/* Section Content */}
      {expanded && (
        <div className="space-y-3">
          {citations.map((cwc) => (
            <HighlightItem
              key={cwc.citation.id}
              citationWithCapture={cwc}
              sourceId={sourceId}
            />
          ))}
          {captures.map((cap) => (
            <CaptureItem
              key={cap.id}
              capture={cap}
              sourceId={sourceId}
            />
          ))}
        </div>
      )}
    </div>
  );
});
