"use client";

import { memo, useCallback } from "react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { CitationDTO } from "@/features/sources/types";
import { cn } from "@/lib/utils";
import { Bookmark, Pencil, Trash2 } from "lucide-react";
import { setCitationHover } from "../source-transcript-page-utils/hover-highlight";

interface CitationMarkProps {
  segment: {
    text: string;
    citationId: number;
    hasCaptures?: boolean;
    citation: CitationDTO;
  };
  onEditCitation?: (citation: CitationDTO) => void;
  onAddToTakeaway?: (citation: CitationDTO) => void;
  onDeleteCitation?: (citation: CitationDTO) => void;
  onCitationClick?: (citationId: number) => void;
  /** Review mode: this mark renders a pending suggestion citation (Phase C styles via data-attr). */
  isSuggestion?: boolean;
  /** Review mode: drop the suggestion's citation draft AND its tied captures. */
  onRemoveSuggestion?: (citationId: number) => void;
  /** Review mode: belongs to the active suggestion. */
  isActiveSuggestion?: boolean;
}

/**
 * Highlighted mark component with context menu for existing citations.
 * Memoized to prevent re-renders when hovering over other citations.
 */
export const CitationMark = memo(function CitationMark({
  segment,
  onEditCitation,
  onAddToTakeaway,
  onDeleteCitation,
  onCitationClick,
  isSuggestion,
  onRemoveSuggestion,
  isActiveSuggestion,
}: CitationMarkProps) {
  const hasCapture = !!segment.hasCaptures;
  const handleMouseEnter = useCallback(() => {
    setCitationHover(segment.citationId, true);
  }, [segment.citationId]);
  const handleMouseLeave = useCallback(() => {
    setCitationHover(segment.citationId, false);
  }, [segment.citationId]);
  const handleClick = useCallback(() => {
    // Don't fire while the user has an active selection — they're cite-ing, not navigating.
    const selection = window.getSelection();
    if (selection && !selection.isCollapsed) return;
    onCitationClick?.(segment.citationId);
  }, [onCitationClick, segment.citationId]);

  return (
    <ContextMenu>
      <ContextMenuTrigger className="select-text! inline!">
        <mark
          data-citation-id={segment.citationId}
          data-citation-kind="mark"
          data-has-capture={hasCapture ? "true" : "false"}
          data-suggestion={isSuggestion ? "true" : undefined}
          data-suggestion-active={isActiveSuggestion ? "true" : undefined}
          className={cn(
            "citation-mark rounded-sm px-0.5 cursor-pointer transition-all duration-200 text-gray-900 dark:text-white",
            hasCapture
              ? "citation-mark--with-capture bg-yellow-200 dark:bg-yellow-800/40 hover:bg-yellow-300 dark:hover:bg-yellow-700/50"
              : "citation-mark--no-capture bg-blue-100 dark:bg-blue-900/30 hover:bg-blue-200 dark:hover:bg-blue-800/40"
          )}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onClick={handleClick}
        >
          {segment.text}
        </mark>
      </ContextMenuTrigger>
      <ContextMenuContent>
        {isSuggestion ? (
          // A suggestion mark is an unsaved draft — its menu drops the draft
          // highlight, not the DB row the saved-citation actions would mutate.
          <ContextMenuItem
            variant="destructive"
            onClick={() => onRemoveSuggestion?.(segment.citationId)}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Remove highlight
          </ContextMenuItem>
        ) : (
          <>
            {onEditCitation && (
              <ContextMenuItem onClick={() => onEditCitation(segment.citation)}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit Citation
              </ContextMenuItem>
            )}
            {onAddToTakeaway && (
              <ContextMenuItem onClick={() => onAddToTakeaway(segment.citation)}>
                <Bookmark className="mr-2 h-4 w-4" />
                Add to Takeaway
              </ContextMenuItem>
            )}
            {onDeleteCitation && (
              <ContextMenuItem
                variant="destructive"
                onClick={() => onDeleteCitation(segment.citation)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </ContextMenuItem>
            )}
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
});
