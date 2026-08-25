"use client";

import { Fragment, memo, useMemo } from "react";
import type { TranscriptUtterance } from "@/features/podcasts/types";
import { CaptureDTO, CitationDTO, CitationWithCapture } from "@/features/sources/types";
import { CitationMark } from "./citation-mark";
import { InlineCaptureCard } from "./inline-capture-card";
import { UtteranceSpan } from "./utterance-span";
import { findHighlightPosition, isMatchFound, type HighlightMatch } from "../source-transcript-page-utils/highlight-matcher";
import type { CitationLocation } from "@/features/sources/utils/location";

interface HighlightedUtterancesProps {
  utterances: TranscriptUtterance[];
  citationsWithCaptures: CitationWithCapture[];
  startIdx: number;
  endIdx: number;
  onEditCitation?: (citation: CitationDTO) => void;
  onAddToTakeaway?: (citation: CitationDTO) => void;
  onDeleteCitation?: (citation: CitationDTO) => void;
  onCitationClick?: (citationId: number) => void;
  /**
   * Suggestion-review mode. When provided, inline capture cards edit text inline
   * and route save/remove to these callbacks (review drafts) instead of the
   * saved-citation dialog. The capture's id is passed back for draft mapping.
   */
  onSaveCaptureText?: (captureId: number, text: string) => void;
  onRemoveCapture?: (captureId: number) => void;
  /**
   * Suggestion-review mode: right-clicking a suggestion highlight removes the
   * whole draft (citation + tied captures) instead of opening the citation menu.
   */
  onRemoveSuggestion?: (citationId: number) => void;
  /**
   * Review mode: synthetic ids of pending suggestion citations/captures (so marks
   * and cards can tag themselves for Phase C styling), and the subset belonging to
   * the active suggestion. Membership is the signal — synthetic ids can't be told
   * apart from real DB ids by range alone, so the caller passes them explicitly.
   */
  reviewIds?: Set<number>;
  activeReviewIds?: Set<number>;
}

/**
 * Renders utterances with highlighting for citations.
 * Uses the highlight-matcher utility for cascading fallback matching.
 * Memoized to prevent re-renders when unrelated sections change.
 */
export const HighlightedUtterances = memo(function HighlightedUtterances({
  utterances,
  citationsWithCaptures,
  startIdx,
  endIdx,
  onEditCitation,
  onAddToTakeaway,
  onDeleteCitation,
  onCitationClick,
  onSaveCaptureText,
  onRemoveCapture,
  onRemoveSuggestion,
  reviewIds,
  activeReviewIds,
}: HighlightedUtterancesProps) {
  const captureMode = onSaveCaptureText || onRemoveCapture ? "suggestion" : "saved";
  // Pre-compute highlight matches for all citations
  const highlightMatches = useMemo(() => {
    const matches: Map<number, { match: HighlightMatch; captures: CaptureDTO[]; citation: CitationDTO }> = new Map();

    citationsWithCaptures.forEach(({ citation, captures }) => {
      const loc = citation.location as CitationLocation | null;
      if (!loc) return;

      // Only process transcript type citations (not legacy av type)
      if (loc.type !== "transcript_v1") return;

      const match = findHighlightPosition(loc, citation.text, utterances);

      // Include citation if the highlight overlaps this section [startIdx, endIdx).
      // Overlap: highlight [startUtteranceIdx, endUtteranceIdx] overlaps when
      // start < endIdx and end >= startIdx. This ensures cross-section citations
      // (that start in a previous paragraph and continue into this one) are
      // rendered in both sections.
      if (
        isMatchFound(match) &&
        match.startUtteranceIdx < endIdx &&
        match.endUtteranceIdx >= startIdx
      ) {
        matches.set(citation.id, { match, captures, citation });
      }
    });

    return matches;
  }, [citationsWithCaptures, utterances, startIdx, endIdx]);

  // Render each utterance in the range
  const sectionUtterances = utterances.slice(startIdx, endIdx);

  return (
    <>
      {sectionUtterances.map((utterance, localIdx) => {
        const globalIdx = startIdx + localIdx;
        const isLast = localIdx === sectionUtterances.length - 1;

        // Inline capture cards: every citation whose highlight ENDS in this
        // utterance gets each of its attached notes rendered as a card after
        // the utterance. This co-locates the user's thoughts with the quote.
        const captureCards: Array<{ citation: CitationDTO; capture: CaptureDTO }> = [];
        highlightMatches.forEach(({ match, captures, citation }) => {
          if (captures.length === 0 || match.endUtteranceIdx !== globalIdx) return;
          for (const capture of captures) {
            captureCards.push({ citation, capture });
          }
        });

        // Find any highlights that start in this utterance
        const highlightsInUtterance: Array<{
          charStart: number;
          charEnd: number;
          citationId: number;
          hasCaptures: boolean;
          citation: CitationDTO;
        }> = [];

        highlightMatches.forEach(({ match, captures, citation }) => {
          if (match.startUtteranceIdx === globalIdx) {
            // Highlight starts in this utterance
            let charEnd = match.charOffsetEnd;

            // If highlight spans multiple utterances, extend to end of this one
            if (match.endUtteranceIdx > globalIdx) {
              charEnd = utterance.text.length;
            }

            highlightsInUtterance.push({
              charStart: match.charOffsetStart,
              charEnd,
              citationId: citation.id,
              hasCaptures: captures.length > 0,
              citation,
            });
          } else if (
            match.startUtteranceIdx < globalIdx &&
            match.endUtteranceIdx >= globalIdx
          ) {
            // Highlight continues through this utterance
            const charEnd =
              match.endUtteranceIdx === globalIdx
                ? match.charOffsetEnd
                : utterance.text.length;

            highlightsInUtterance.push({
              charStart: 0,
              charEnd,
              citationId: citation.id,
              hasCaptures: captures.length > 0,
              citation,
            });
          }
        });

        // Sort highlights by start position
        highlightsInUtterance.sort((a, b) => a.charStart - b.charStart);

        // Remove overlaps (keep first)
        const nonOverlapping = highlightsInUtterance.filter((h, i) => {
          if (i === 0) return true;
          const prev = highlightsInUtterance[i - 1];
          return h.charStart >= prev.charEnd;
        });

        // Build segments for this utterance
        const text = utterance.text;
        const segments: Array<{
          text: string;
          isHighlighted: boolean;
          citationId?: number;
          hasCaptures?: boolean;
          citation?: CitationDTO;
        }> = [];

        let pos = 0;
        nonOverlapping.forEach((h) => {
          if (h.charStart > pos) {
            segments.push({ text: text.slice(pos, h.charStart), isHighlighted: false });
          }
          segments.push({
            text: text.slice(h.charStart, h.charEnd),
            isHighlighted: true,
            citationId: h.citationId,
            hasCaptures: h.hasCaptures,
            citation: h.citation,
          });
          pos = h.charEnd;
        });

        if (pos < text.length) {
          segments.push({ text: text.slice(pos), isHighlighted: false });
        }

        // If no highlights, just render the text
        if (segments.length === 0) {
          segments.push({ text, isHighlighted: false });
        }

        return (
          <Fragment key={globalIdx}>
            <UtteranceSpan utterance={utterance} index={globalIdx}>
              {segments.map((segment, segIdx) => {
                if (segment.isHighlighted && segment.citationId && segment.citation) {
                  return (
                    <CitationMark
                      key={segIdx}
                      segment={{
                        text: segment.text,
                        citationId: segment.citationId,
                        hasCaptures: segment.hasCaptures ?? false,
                        citation: segment.citation,
                      }}
                      onEditCitation={onEditCitation}
                      onAddToTakeaway={onAddToTakeaway}
                      onDeleteCitation={onDeleteCitation}
                      onCitationClick={onCitationClick}
                      onRemoveSuggestion={onRemoveSuggestion}
                      isSuggestion={reviewIds?.has(segment.citationId)}
                      isActiveSuggestion={activeReviewIds?.has(segment.citationId)}
                    />
                  );
                }
                return <span key={segIdx}>{segment.text}</span>;
              })}
              {!isLast && " "}
            </UtteranceSpan>
            {captureCards.map(({ citation, capture }) => (
              <InlineCaptureCard
                key={`cap-${capture.id}`}
                citation={citation}
                capture={capture}
                mode={captureMode}
                onSaveText={onSaveCaptureText ? (text) => onSaveCaptureText(capture.id, text) : undefined}
                onRemove={onRemoveCapture ? () => onRemoveCapture(capture.id) : undefined}
                isActiveSuggestion={activeReviewIds?.has(capture.id)}
              />
            ))}
          </Fragment>
        );
      })}
    </>
  );
});
