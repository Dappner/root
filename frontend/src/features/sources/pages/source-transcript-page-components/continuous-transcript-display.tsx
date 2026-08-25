"use client";

import { useSearchParams } from "@/lib/nav";
import { useDialog, useDialogStore } from "@/components/dialogs";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import type { TranscriptUtterance } from "@/features/podcasts/types";
import { CitationDialog } from "@/features/sources/dialogs/citation-dialog";
import { DeleteCitationDialog } from "@/features/sources/dialogs/delete-citation-dialog";
import { EditSectionDialog } from "@/features/sources/dialogs/edit-section-dialog";
import { AddToTakeawayDialog } from "@/features/takeaways/dialogs/add-to-takeaway-dialog";
import { useCitationsWithCaptures } from "@/features/sources/hooks/citations";
import { useReviewMode, type ReviewMode } from "@/features/suggestions/components/review-screen/use-review-mode";
import { decodeReviewId } from "@/features/suggestions/components/review-screen/review-ids";
import { useSourceSections } from "@/features/sources/hooks/sections";
import { CitationDTO, CitationWithCapture, SourceSectionDTO } from "@/features/sources/types";
import { getLocationTimestamp, type CitationLocation } from "@/features/sources/utils/location";
import { useKeyboardShortcut } from "@/hooks/use-keyboard-shortcut";
import { useBreakpoint } from "@/hooks/use-viewport";
import { formatTime } from "@/lib/utils";
import { Plus, ArrowDown, Pencil, Play, X } from "lucide-react";
import { usePlayerStore } from "@/features/player/store";
import { useSourceSectionsSidebar } from "@/features/sources/components/source-sections-sidebar/store";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { captureTranscriptSelection, hasTranscriptSelection } from "../source-transcript-page-utils/selection-capture";
import { AutoScrollToggle } from "./auto-scroll-toggle";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CaptureGutter } from "./capture-gutter";
import { flashElement } from "../source-transcript-page-utils/flash-element";
import { HighlightedUtterances } from "./highlighted-utterances";
import { ReviewOverlay } from "@/features/suggestions/components/review-screen/review-overlay";
import { SectionHighlighter } from "./section-highlighter";
import { TimestampMarker } from "./timestamp-marker";

interface ContinuousTranscriptDisplayProps {
  utterances: TranscriptUtterance[];
  sourceId: number;
  onSeek: (time: number) => void;
  playerType: "podcast" | "video";
  playerIsVisible: boolean;
}

interface TranscriptTimestampMarker {
  time: number;
  utteranceStartIdx: number;
  utteranceEndIdx: number;
}

export const ContinuousTranscriptDisplay = memo(function ContinuousTranscriptDisplay({
  utterances,
  sourceId,
  onSeek,
  playerType,
  playerIsVisible,
}: ContinuousTranscriptDisplayProps) {
  const searchParams = useSearchParams();
  const reviewEnabled = searchParams.get("review") === "1";
  const { openDialog } = useDialog();
  const dialogOpen = useDialogStore((state) => state.open);
  const [autoScrollEnabled, setAutoScrollEnabled] = useState(false);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const hasAutoResumedRef = useRef(false);
  const hasScrolledToSectionRef = useRef(false);

  const { data: citationsWithCaptures, isLoading: citationsLoading } = useCitationsWithCaptures(sourceId);
  const { data: sections } = useSourceSections(sourceId);

  // Single review-mode instance shared by the body, the gutter, and the overlay.
  // `enabled` keeps it inert (active:false, empty arrays, zero suggestions fetch)
  // when not in review, so the saved path is unchanged.
  const review = useReviewMode(sourceId, reviewEnabled);

  // After the saved citations so synthetic review ids (≥1M) don't collide. When
  // review is inert this is the exact saved set, so the saved gutter is unchanged.
  const mergedCitations = useMemo(
    () =>
      review.active
        ? [...citationsWithCaptures, ...review.citationsWithCaptures]
        : citationsWithCaptures,
    [review.active, review.citationsWithCaptures, citationsWithCaptures],
  );

  // Synthetic-id membership drives data-attr tagging in marks/cards. A synthetic
  // id decodes to its suggestion index, so an item is "active" when that index
  // matches the active suggestion.
  const { reviewIds, activeReviewIds } = useMemo(() => {
    const all = new Set<number>();
    const active = new Set<number>();
    const activeId = review.suggestions[review.activeIndex]?.id;
    const tag = (id: number) => {
      all.add(id);
      if (review.suggestions[decodeReviewId(id).suggestionIndex]?.id === activeId) {
        active.add(id);
      }
    };
    review.citationsWithCaptures.forEach(({ citation, captures }) => {
      tag(citation.id);
      for (const capture of captures) tag(capture.id);
    });
    return { reviewIds: all, activeReviewIds: active };
  }, [review.citationsWithCaptures, review.suggestions, review.activeIndex]);

  const sectionsSidebarOpen = useSourceSectionsSidebar((s) => s.isOpen);
  const { isLarge } = useBreakpoint();

  // Gutter needs horizontal room: viewport ≥ xl AND sections sidebar closed.
  const GUTTER_WIDTH_PX = 320;
  const gutterActive = isLarge && !sectionsSidebarOpen;

  // Podcast utterances (AssemblyAI): merge consecutive short utterances until the
  // running paragraph hits ~MIN_PARAGRAPH_CHARS, then break. A single long
  // utterance becomes its own paragraph (it already exceeds the threshold).
  // Video utterances (YouTube captions): bucket by 30s — captions are tiny
  // fragments and time-based bucketing better matches video pacing.
  const timestampMarkers = useMemo<TranscriptTimestampMarker[]>(() => {
    if (utterances.length === 0) return [];

    if (playerType === "podcast") {
      const MIN_PARAGRAPH_CHARS = 300;
      const markers: TranscriptTimestampMarker[] = [];
      let bucketStartIdx = 0;
      let bucketChars = 0;

      for (let idx = 0; idx < utterances.length; idx++) {
        bucketChars += utterances[idx].text.length;
        if (bucketChars >= MIN_PARAGRAPH_CHARS) {
          markers.push({
            time: utterances[bucketStartIdx].start,
            utteranceStartIdx: bucketStartIdx,
            utteranceEndIdx: idx + 1,
          });
          bucketStartIdx = idx + 1;
          bucketChars = 0;
        }
      }

      if (bucketStartIdx < utterances.length) {
        markers.push({
          time: utterances[bucketStartIdx].start,
          utteranceStartIdx: bucketStartIdx,
          utteranceEndIdx: utterances.length,
        });
      }

      return markers;
    }

    const BUCKET_SECONDS = 30;
    const markers: TranscriptTimestampMarker[] = [];
    let sectionStartTime = utterances[0].start;

    markers.push({
      time: sectionStartTime,
      utteranceStartIdx: 0,
      utteranceEndIdx: utterances.length,
    });

    for (let idx = 1; idx < utterances.length; idx++) {
      const elapsed = utterances[idx].start - sectionStartTime;
      if (elapsed >= BUCKET_SECONDS) {
        markers[markers.length - 1].utteranceEndIdx = idx;
        markers.push({
          time: utterances[idx].start,
          utteranceStartIdx: idx,
          utteranceEndIdx: utterances.length,
        });
        sectionStartTime = utterances[idx].start;
      }
    }

    return markers;
  }, [utterances, playerType]);

  // Map each semantic section to the timestamp-marker block where its header
  // should render. Snap section.range_start to the nearest preceding marker so
  // headers align with the existing 30s/paragraph boundaries — sub-marker
  // precision isn't useful and creates visual noise.
  const sectionByMarker = useMemo<Map<number, SourceSectionDTO>>(() => {
    const map = new Map<number, SourceSectionDTO>();
    if (!sections?.length || timestampMarkers.length === 0) return map;

    // Sort by range_start so earlier sections claim earlier markers when two
    // would land on the same one.
    const withStart = sections
      .filter((s) => typeof s.range_start === "number")
      .sort((a, b) => (a.range_start ?? 0) - (b.range_start ?? 0));

    for (const section of withStart) {
      const target = section.range_start ?? 0;
      let markerIndex = 0;
      for (let i = 0; i < timestampMarkers.length; i++) {
        if (timestampMarkers[i].time <= target) {
          markerIndex = i;
        } else {
          break;
        }
      }
      if (!map.has(markerIndex)) {
        map.set(markerIndex, section);
      }
    }

    return map;
  }, [sections, timestampMarkers]);

  // Handle hash fragment navigation (#t-{timestamp})
  useEffect(() => {
    if (typeof window === 'undefined' || timestampMarkers.length === 0) return;

    const hash = window.location.hash;
    if (!hash.startsWith('#t-')) return;

    const timestamp = parseFloat(hash.substring(3));
    if (isNaN(timestamp)) return;

    // Find the marker index that contains this timestamp
    let targetMarkerIndex = -1;
    for (let i = timestampMarkers.length - 1; i >= 0; i--) {
      if (timestamp >= timestampMarkers[i].time) {
        targetMarkerIndex = i;
        break;
      }
    }

    if (targetMarkerIndex < 0) targetMarkerIndex = 0;

    // Small delay to ensure DOM is rendered
    setTimeout(() => {
      const element = document.getElementById(`ts-marker-${targetMarkerIndex}`);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 100);
  }, [timestampMarkers]);

  // Handle creating citation using DOM-based selection capture
  const handleCreateCitationFromSelection = useCallback(() => {
    // Use the DOM-based capture utility for reliable timestamp extraction
    const capture = captureTranscriptSelection();

    if (!capture) {
      // Fallback: check if there's any selection at all
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) {
        toast.error("Please select some text first");
        return;
      }

      // Selection is outside transcript utterances
      toast.error("Please select text within the transcript");
      return;
    }

    openDialog(CitationDialog, {
      mode: "create",
      flow: "derived",
      sourceId,
      quoteText: capture.text,
      location: capture.location,
    });

    window.getSelection()?.removeAllRanges();
  }, [sourceId, openDialog]);

  useKeyboardShortcut(() => {
    if (!hasTranscriptSelection()) return;
    handleCreateCitationFromSelection();
  }, { key: "+", shiftKey: true });

  // Toggle the sections sidebar with `]`.
  useKeyboardShortcut(() => {
    if (dialogOpen) return;
    useSourceSectionsSidebar.getState().toggle();
  }, { key: "]", enabled: !dialogOpen });

  // Toggle auto-scroll with 'A' key (handle both uppercase and lowercase)
  useKeyboardShortcut(() => {
    if (dialogOpen) return;
    setAutoScrollEnabled((prev) => !prev);
  }, { key: "a", enabled: !dialogOpen });
  useKeyboardShortcut(() => {
    if (dialogOpen) return;
    setAutoScrollEnabled((prev) => !prev);
  }, { key: "A", enabled: !dialogOpen });

  const handleEditCitation = useCallback((citation: CitationDTO) => {
    // Check if this is a transcript quote
    const location = citation.location as CitationLocation | null;
    const isTranscript = location?.type === "transcript_v1";

    openDialog(CitationDialog, {
      mode: "update",
      flow: isTranscript ? "derived" : "manual",
      citation,
      sourceId,
    });
  }, [openDialog, sourceId]);

  const handleAddToTakeaway = useCallback((citation: CitationDTO) => {
    openDialog(AddToTakeawayDialog, {
      sourceId,
      citationId: citation.id,
    });
  }, [openDialog, sourceId]);

  const handleDeleteCitation = useCallback((citation: CitationDTO) => {
    const captures = citationsWithCaptures.find(
      (item) => item.citation.id === citation.id
    )?.captures ?? [];
    openDialog(DeleteCitationDialog, {
      citation,
      sourceId,
      hasCapture: captures.length > 0,
    });
  }, [citationsWithCaptures, openDialog, sourceId]);

  // Clicking an inline highlight scrolls to the matching capture card and
  // flashes it. If no capture exists yet, open the citation dialog so the user
  // can add a note. Both inline and gutter variants render the card; scope to
  // the active variant so display:none cards aren't picked.
  const handleInlineCitationClick = useCallback(
    (citationId: number) => {
      const variant = gutterActive ? "gutter" : "inline";
      const card = document.querySelector(
        `[data-capture-card="true"][data-capture-variant="${variant}"][data-citation-id="${citationId}"]`,
      ) as HTMLElement | null;

      if (card) {
        card.scrollIntoView({ behavior: "smooth", block: "center" });
        setTimeout(() => flashElement(card), 200);
        return;
      }

      const item = citationsWithCaptures.find(
        (c) => c.citation.id === citationId,
      );
      if (item) {
        openDialog(CitationDialog, {
          mode: "update",
          flow: "derived",
          citation: item.citation,
          sourceId,
        });
      }
    },
    [citationsWithCaptures, openDialog, gutterActive, sourceId],
  );

  // Scroll to last highlight
  const scrollToLastHighlight = useCallback((options?: { silentIfMissing?: boolean }) => {
    // Get all transcript-type citations (not just those with captures)
    const transcriptCitations = citationsWithCaptures.filter((item) => {
      const loc = item.citation.location as CitationLocation | null;
      const timestamp = getLocationTimestamp(loc);
      return loc?.type === "transcript_v1" && timestamp?.startSec !== undefined;
    });

    if (transcriptCitations.length === 0) {
      if (!options?.silentIfMissing) {
        toast.info("No highlights found in transcript");
      }
      return false;
    }

    // Find the citation with the maximum timestamp (most recent/last in transcript)
    // Use the end time if available, otherwise use start time
    let lastCitation = transcriptCitations[0];
    let maxTime = 0;

    for (const item of transcriptCitations) {
      const timestamp = getLocationTimestamp(item.citation.location as CitationLocation | null);
      const startTime = timestamp?.startSec ?? 0;
      const endTime = timestamp?.endSec ?? startTime; // Use end time if available, fallback to start
      const time = Math.max(startTime, endTime); // Use the later of start or end

      if (time > maxTime) {
        maxTime = time;
        lastCitation = item;
      }
    }

    const lastCitationId = lastCitation.citation.id;
    const lastCitationTime = getLocationTimestamp(
      lastCitation.citation.location as CitationLocation | null
    )?.startSec ?? 0;

    // Find the timestamp marker section that contains this highlight
    let targetMarkerIndex = -1;
    for (let i = timestampMarkers.length - 1; i >= 0; i--) {
      if (lastCitationTime >= timestampMarkers[i].time) {
        targetMarkerIndex = i;
        break;
      }
    }

    if (targetMarkerIndex < 0) {
      targetMarkerIndex = 0; // Fallback to first marker
    }

    // Use a small delay to ensure DOM is ready
    setTimeout(() => {
      // First, scroll to the timestamp marker section
      const markerElement = document.getElementById(`ts-marker-${targetMarkerIndex}`);
      if (markerElement) {
        markerElement.scrollIntoView({ behavior: "smooth", block: "center" });
      }

      // Then try to find and scroll to the actual highlight element.
      // Scope to the inline <mark> kind so the sidebar's matching row (which
      // also carries data-citation-id for hover-sync) doesn't get selected.
      setTimeout(() => {
        const container = transcriptRef.current;
        const selector = `[data-citation-kind="mark"][data-citation-id="${lastCitationId}"]`;
        const highlightElement = (container
          ? container.querySelector(selector)
          : document.querySelector(selector)) as HTMLElement | null;

        if (highlightElement) {
          highlightElement.scrollIntoView({ behavior: "smooth", block: "center" });
          flashElement(highlightElement);
        }
      }, 300);
    }, 100);
    return true;
  }, [citationsWithCaptures, timestampMarkers]);

  const handleScrollToLastHighlight = useCallback(() => {
    scrollToLastHighlight();
  }, [scrollToLastHighlight]);

  useEffect(() => {
    if (searchParams.get("resume") !== "last-highlight" || hasAutoResumedRef.current) {
      return;
    }

    if (utterances.length === 0 || citationsLoading) {
      return;
    }

    hasAutoResumedRef.current = true;
    scrollToLastHighlight({ silentIfMissing: true });
  }, [citationsLoading, scrollToLastHighlight, searchParams, utterances.length]);

  // Scroll to a section when arriving with ?section=<id> (from the sections sidebar).
  // Wait for utterances + sections so the header element has rendered.
  useEffect(() => {
    const sectionParam = searchParams.get("section");
    if (!sectionParam || hasScrolledToSectionRef.current) return;
    if (utterances.length === 0 || !sections || sections.length === 0) return;

    hasScrolledToSectionRef.current = true;
    setTimeout(() => {
      const el = document.querySelector(
        `[data-section-id="${sectionParam}"]`,
      ) as HTMLElement | null;
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
        flashElement(el);
      }
    }, 100);
  }, [searchParams, utterances.length, sections]);

  return (
    <div
      data-gutter-active={gutterActive ? "true" : "false"}
      className="relative space-y-4 pb-20 transition-[padding] duration-200 ease-out"
      style={gutterActive ? { paddingRight: `${GUTTER_WIDTH_PX + 24}px` } : undefined}
    >
      <SectionHighlighter
        timestampMarkers={timestampMarkers}
        autoScrollEnabled={autoScrollEnabled}
        containerRef={transcriptRef}
      />
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {utterances.length.toLocaleString()} segments • Click timestamp to jump • Select text + Shift++ to cite
          </p>
          {(() => {
            // Check if there are any transcript citations (not just captures)
            const hasTranscriptCitations = citationsWithCaptures.some((item) => {
              const loc = item.citation.location as CitationLocation | null;
              const timestamp = getLocationTimestamp(loc);
              return loc?.type === "transcript_v1" && timestamp?.startSec !== undefined;
            });
            return hasTranscriptCitations ? (
              <Button
                variant="outline"
                size="sm"
                onClick={handleScrollToLastHighlight}
                className="flex items-center gap-2"
              >
                <ArrowDown className="w-4 h-4" />
                Last Highlight
              </Button>
            ) : null;
          })()}
        </div>

        {/* Two column layout: main content | annotations */}
        <ContextMenu>
          <ContextMenuTrigger className="select-text!">
            {/* useReviewMode runs in the outer component with enabled=reviewEnabled,
                so the saved transcript view stays zero-fetch and the gutter shares
                the same review instance. */}
            {reviewEnabled ? (
              <ReviewTranscriptBody
                transcriptRef={transcriptRef}
                sourceId={sourceId}
                utterances={utterances}
                mergedCitations={mergedCitations}
                review={review}
                reviewIds={reviewIds}
                activeReviewIds={activeReviewIds}
                timestampMarkers={timestampMarkers}
                sectionByMarker={sectionByMarker}
                onSeek={onSeek}
                onEditCitation={handleEditCitation}
                onAddToTakeaway={handleAddToTakeaway}
                onDeleteCitation={handleDeleteCitation}
                onCitationClick={handleInlineCitationClick}
              />
            ) : (
              <TranscriptBody
                transcriptRef={transcriptRef}
                sourceId={sourceId}
                utterances={utterances}
                citationsWithCaptures={citationsWithCaptures}
                timestampMarkers={timestampMarkers}
                sectionByMarker={sectionByMarker}
                onSeek={onSeek}
                onEditCitation={handleEditCitation}
                onAddToTakeaway={handleAddToTakeaway}
                onDeleteCitation={handleDeleteCitation}
                onCitationClick={handleInlineCitationClick}
              />
            )}
            {gutterActive && (
              <CaptureGutter
                containerRef={transcriptRef}
                width={GUTTER_WIDTH_PX}
                citationsWithCaptures={mergedCitations}
                review={
                  review.active
                    ? {
                        isReview: (id) => reviewIds.has(id),
                        activeIds: activeReviewIds,
                        onSaveText: review.editById,
                        onRemove: review.removeById,
                      }
                    : undefined
                }
              />
            )}
          </ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuItem onClick={handleCreateCitationFromSelection}>
              <Plus className="mr-2 h-4 w-4" />
              Create Citation from Selection
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>

        {/* Auto-scroll Toggle: only when a player is shown (podcast always has one; video only when floating player is visible) */}
        {(playerType === "podcast" || (playerType === "video" && playerIsVisible)) && (
          <AutoScrollToggle
            enabled={autoScrollEnabled}
            onToggle={() => setAutoScrollEnabled(!autoScrollEnabled)}
          />
        )}
    </div>
  );
});

interface ReviewTranscriptBodyProps {
  transcriptRef: React.RefObject<HTMLDivElement | null>;
  sourceId: number;
  utterances: TranscriptUtterance[];
  /** Saved + pending review citations, merged in the outer component. */
  mergedCitations: CitationWithCapture[];
  /** Shared review-mode instance (one hook for body + gutter + overlay). */
  review: ReviewMode;
  reviewIds: Set<number>;
  activeReviewIds: Set<number>;
  timestampMarkers: TranscriptTimestampMarker[];
  sectionByMarker: Map<number, SourceSectionDTO>;
  onSeek: (time: number) => void;
  onEditCitation: (citation: CitationDTO) => void;
  onAddToTakeaway: (citation: CitationDTO) => void;
  onDeleteCitation: (citation: CitationDTO) => void;
  onCitationClick?: (citationId: number) => void;
}

/**
 * Mounted only under `?review=1`. Renders the transcript body with the shared
 * review-mode data (merged citations + draft edit/remove callbacks) and the
 * active suggestion's standalone captures. The review hook and the merge live in
 * the outer component so the gutter shares them. Suggestion marks/cards edit
 * their drafts inline; the saved-citation menu only applies outside review.
 */
const ReviewTranscriptBody = memo(function ReviewTranscriptBody({
  transcriptRef,
  sourceId,
  utterances,
  mergedCitations,
  review,
  reviewIds,
  activeReviewIds,
  timestampMarkers,
  sectionByMarker,
  onSeek,
  onEditCitation,
  onAddToTakeaway,
  onDeleteCitation,
  onCitationClick,
}: ReviewTranscriptBodyProps) {
  const body = (
    <TranscriptBody
      transcriptRef={transcriptRef}
      sourceId={sourceId}
      utterances={utterances}
      citationsWithCaptures={mergedCitations}
      timestampMarkers={timestampMarkers}
      sectionByMarker={sectionByMarker}
      onSeek={onSeek}
      onEditCitation={onEditCitation}
      onAddToTakeaway={onAddToTakeaway}
      onDeleteCitation={onDeleteCitation}
      onCitationClick={onCitationClick}
      review={
        review.active
          ? {
              reviewIds,
              activeReviewIds,
              onSaveCaptureText: review.editById,
              onRemoveCapture: review.removeById,
              onRemoveSuggestion: review.removeCitationGroup,
            }
          : undefined
      }
    />
  );

  if (!review.active) return body;

  return (
    <>
      {body}
      <ReviewOverlay review={review} containerRef={transcriptRef} />
      {review.activeStandaloneCaptures.length > 0 && (
        <div
          data-suggestion="true"
          data-suggestion-active="true"
          className="mt-4 space-y-2 rounded-md border border-border/60 p-3"
        >
          <p className="text-xs font-medium text-muted-foreground">Notes without a quote</p>
          {review.activeStandaloneCaptures.map(({ id, capture }) => (
            <StandaloneNoteRow
              key={id}
              text={capture.text ?? ""}
              onSaveText={(text) => review.editById(id, text)}
              onRemove={() => review.removeById(id)}
            />
          ))}
        </div>
      )}
    </>
  );
});

/** A standalone-note row (no quote tie) with inline edit, mirroring the cards. */
const StandaloneNoteRow = memo(function StandaloneNoteRow({
  text,
  onSaveText,
  onRemove,
}: {
  text: string;
  onSaveText: (text: string) => void;
  onRemove: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(text);

  if (editing) {
    return (
      <div className="space-y-2">
        <Textarea
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="min-h-16 resize-y text-sm leading-snug"
        />
        <div className="flex justify-end gap-1.5">
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setEditing(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => {
              onSaveText(draft);
              setEditing(false);
            }}
          >
            Save
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start justify-between gap-2">
      <p className="whitespace-pre-wrap text-sm leading-snug text-foreground">{text}</p>
      <div className="flex shrink-0 items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          aria-label="Edit note"
          onClick={() => {
            setDraft(text);
            setEditing(true);
          }}
        >
          <Pencil className="size-3.5 text-muted-foreground" />
        </Button>
        <Button variant="ghost" size="icon" className="size-7" aria-label="Remove note" onClick={onRemove}>
          <X className="size-3.5 text-muted-foreground" />
        </Button>
      </div>
    </div>
  );
});

/** Review-mode extras passed into the body; absent on the saved transcript view. */
interface TranscriptBodyReview {
  reviewIds: Set<number>;
  activeReviewIds: Set<number>;
  onSaveCaptureText: (captureId: number, text: string) => void;
  onRemoveCapture: (captureId: number) => void;
  onRemoveSuggestion: (citationId: number) => void;
}

interface TranscriptBodyProps {
  transcriptRef: React.RefObject<HTMLDivElement | null>;
  sourceId: number;
  utterances: TranscriptUtterance[];
  citationsWithCaptures: CitationWithCapture[];
  timestampMarkers: TranscriptTimestampMarker[];
  sectionByMarker: Map<number, SourceSectionDTO>;
  onSeek: (time: number) => void;
  onEditCitation: (citation: CitationDTO) => void;
  onAddToTakeaway: (citation: CitationDTO) => void;
  onDeleteCitation: (citation: CitationDTO) => void;
  onCitationClick?: (citationId: number) => void;
  review?: TranscriptBodyReview;
}

const TranscriptBody = memo(function TranscriptBody({
  transcriptRef,
  sourceId,
  utterances,
  citationsWithCaptures,
  timestampMarkers,
  sectionByMarker,
  onSeek,
  onEditCitation,
  onAddToTakeaway,
  onDeleteCitation,
  onCitationClick,
  review,
}: TranscriptBodyProps) {
  return (
    <div ref={transcriptRef} className="space-y-4">
      {timestampMarkers.map((marker, markerIndex) => {
        const nextMarker = timestampMarkers[markerIndex + 1];
        const sectionHeader = sectionByMarker.get(markerIndex);

        return (
          <div key={markerIndex}>
            {sectionHeader && (
              <SectionHeader
                section={sectionHeader}
                sourceId={sourceId}
                seekTime={marker.time}
                onSeek={onSeek}
              />
            )}
            <div className="flex gap-4">
              {/* Timestamp column - fixed width, not selectable */}
              <TimestampMarker
                time={marker.time}
                markerIndex={markerIndex}
                onSeek={onSeek}
              />

              {/* Text column - selectable, with utterances as data-attribute spans */}
              <div
                data-section-index={markerIndex}
                className="transcript-section"
              >
                <HighlightedUtterances
                  utterances={utterances}
                  citationsWithCaptures={citationsWithCaptures}
                  startIdx={marker.utteranceStartIdx}
                  endIdx={nextMarker?.utteranceStartIdx ?? utterances.length}
                  onEditCitation={onEditCitation}
                  onAddToTakeaway={onAddToTakeaway}
                  onDeleteCitation={onDeleteCitation}
                  onCitationClick={onCitationClick}
                  onSaveCaptureText={review?.onSaveCaptureText}
                  onRemoveCapture={review?.onRemoveCapture}
                  onRemoveSuggestion={review?.onRemoveSuggestion}
                  reviewIds={review?.reviewIds}
                  activeReviewIds={review?.activeReviewIds}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
});

interface SectionHeaderProps {
  section: SourceSectionDTO;
  sourceId: number;
  /** Time to seek to when the play button is clicked. Use the paragraph
   *  marker's time (where the header visually sits), not section.range_start —
   *  those can drift, leaving playback in the next paragraph. */
  seekTime: number;
  onSeek: (time: number) => void;
}

const SectionHeader = memo(function SectionHeader({
  section,
  sourceId,
  seekTime,
  onSeek,
}: SectionHeaderProps) {
  const { openDialog } = useDialog();

  const handlePlay = () => {
    onSeek(seekTime);
    usePlayerStore.getState().play();
  };

  const handleEdit = () => openDialog(EditSectionDialog, { sourceId, section });

  return (
    <ContextMenu>
      <ContextMenuTrigger
        render={
          <h2
            data-section-id={section.id}
            style={{ userSelect: "none" }}
            className="mt-6 mb-3 flex items-center gap-2 text-lg font-semibold tracking-tight text-foreground"
          >
            <button
              type="button"
              onClick={handlePlay}
              aria-label={`Play from ${formatTime(seekTime)}`}
              title={`Play from ${formatTime(seekTime)}`}
              className="inline-flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform hover:scale-105"
            >
              <Play className="size-3 fill-current" />
            </button>
            <span>{section.title}</span>
            <span className="text-xs font-normal tabular-nums text-muted-foreground">
              {formatTime(seekTime)}
            </span>
          </h2>
        }
      />
      <ContextMenuContent>
        <ContextMenuItem onClick={handleEdit}>
          <Pencil className="mr-2 h-4 w-4" />
          Edit section
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
});
