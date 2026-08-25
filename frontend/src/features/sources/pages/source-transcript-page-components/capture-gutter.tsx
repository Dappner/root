"use client";

import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CaptureDTO, CitationDTO, CitationWithCapture } from "@/features/sources/types";
import { InlineCaptureCard } from "./inline-capture-card";

/** Review-mode wiring; absent on the saved transcript view (cards stay mode="saved"). */
interface CaptureGutterReview {
  /** True when this capture id belongs to a pending review draft. */
  isReview: (captureId: number) => boolean;
  /** Capture ids belonging to the active suggestion. */
  activeIds: Set<number>;
  /** Persist a review draft capture's inline-edited text. */
  onSaveText: (captureId: number, text: string) => void;
  /** Drop a review draft capture. */
  onRemove: (captureId: number) => void;
}

interface CaptureGutterProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
  width: number;
  citationsWithCaptures: CitationWithCapture[];
  review?: CaptureGutterReview;
}

interface PositionedCard {
  citation: CitationDTO;
  capture: CaptureDTO;
  top: number;
}

const CARD_GAP_PX = 8;
const FALLBACK_HEIGHT_PX = 60;
const POSITION_EPSILON_PX = 0.5;

function samePositions(a: PositionedCard[], b: PositionedCard[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].capture.id !== b[i].capture.id) return false;
    if (Math.abs(a[i].top - b[i].top) > POSITION_EPSILON_PX) return false;
  }
  return true;
}

export const CaptureGutter = memo(function CaptureGutter({
  containerRef,
  width,
  citationsWithCaptures,
  review,
}: CaptureGutterProps) {
  const candidates = useMemo(
    () =>
      citationsWithCaptures.flatMap(({ citation, captures }) =>
        captures.map((capture) => ({ citation, capture })),
      ),
    [citationsWithCaptures],
  );

  const cardRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const cardObserverRef = useRef<ResizeObserver | null>(null);
  const [positions, setPositions] = useState<PositionedCard[]>([]);
  const [layoutTick, setLayoutTick] = useState(0);

  const scheduleRelayout = useRef<() => void>(() => {});
  useEffect(() => {
    let frame = 0;
    scheduleRelayout.current = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        setLayoutTick((t) => t + 1);
      });
    };
    return () => {
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => scheduleRelayout.current());
    observer.observe(el);
    return () => observer.disconnect();
  }, [containerRef]);

  // Observe each card's size — initial mount (0 → actual height) and any later
  // content reflow both need to trigger a re-layout so the stacking pass uses
  // measured heights instead of the fallback.
  useEffect(() => {
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => scheduleRelayout.current());
    cardObserverRef.current = observer;
    return () => {
      observer.disconnect();
      cardObserverRef.current = null;
    };
  }, []);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    if (candidates.length === 0) {
      setPositions((prev) => (prev.length === 0 ? prev : []));
      return;
    }

    const containerTop = container.getBoundingClientRect().top;
    const anchorById = new Map<string, HTMLElement>();
    for (const el of container.querySelectorAll<HTMLElement>(
      '[data-citation-kind="mark"][data-citation-id]',
    )) {
      const id = el.dataset.citationId;
      if (id && !anchorById.has(id)) anchorById.set(id, el);
    }

    const anchored: PositionedCard[] = [];
    for (const { citation, capture } of candidates) {
      const anchor = anchorById.get(String(citation.id));
      if (!anchor) continue;
      const top = anchor.getBoundingClientRect().top - containerTop;
      anchored.push({ citation, capture, top });
    }

    anchored.sort((a, b) => a.top - b.top);

    let lastBottom = -Infinity;
    for (const item of anchored) {
      const height = cardRefs.current.get(item.capture.id)?.offsetHeight ?? FALLBACK_HEIGHT_PX;
      if (item.top < lastBottom + CARD_GAP_PX) {
        item.top = lastBottom + CARD_GAP_PX;
      }
      lastBottom = item.top + height;
    }

    // Skip the state update if nothing meaningfully changed — otherwise the
    // ResizeObserver on cards would notice each setPositions and reschedule,
    // looping forever.
    setPositions((prev) => (samePositions(prev, anchored) ? prev : anchored));
  }, [candidates, layoutTick, containerRef]);

  if (positions.length === 0) return null;

  return (
    <div
      aria-hidden={false}
      className="pointer-events-none absolute top-0"
      style={{ right: 0, width }}
    >
      {positions.map(({ citation, capture, top }) => {
        const isReview = review?.isReview(capture.id) ?? false;
        return (
          <div
            key={capture.id}
            ref={(el) => {
              const id = capture.id;
              const observer = cardObserverRef.current;
              const prev = cardRefs.current.get(id);
              if (prev && prev !== el) observer?.unobserve(prev);
              if (el) {
                cardRefs.current.set(id, el);
                observer?.observe(el);
              } else {
                cardRefs.current.delete(id);
              }
            }}
            className="pointer-events-auto absolute left-0 right-0"
            style={{ top }}
          >
            <InlineCaptureCard
              citation={citation}
              capture={capture}
              variant="gutter"
              mode={isReview ? "suggestion" : "saved"}
              isActiveSuggestion={isReview ? review!.activeIds.has(capture.id) : undefined}
              onSaveText={isReview ? (text) => review!.onSaveText(capture.id, text) : undefined}
              onRemove={isReview ? () => review!.onRemove(capture.id) : undefined}
            />
          </div>
        );
      })}
    </div>
  );
});
