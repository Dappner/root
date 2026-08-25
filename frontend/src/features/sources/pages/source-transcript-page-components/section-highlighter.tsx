"use client";

import type { RefObject } from "react";
import { useLayoutEffect, useMemo, useRef } from "react";
import { useMediaPlayerSafe } from "@/features/sources/contexts/media-player-context";

interface TimestampMarker {
  time: number;
}

interface SectionHighlighterProps {
  timestampMarkers: TimestampMarker[];
  autoScrollEnabled: boolean;
  containerRef: RefObject<HTMLElement | null>;
}

function findMarkerIndex(markers: TimestampMarker[], currentTime: number): number {
  if (markers.length === 0) return -1;

  let low = 0;
  let high = markers.length - 1;
  let best = 0;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (currentTime >= markers[mid].time) {
      best = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return best;
}

export function SectionHighlighter({
  timestampMarkers,
  autoScrollEnabled,
  containerRef,
}: SectionHighlighterProps) {
  const player = useMediaPlayerSafe();
  const currentTime = player?.currentTime ?? 0;
  const prevIndexRef = useRef<number | null>(null);

  const currentMarkerIndex = useMemo(() => {
    return findMarkerIndex(timestampMarkers, currentTime);
  }, [currentTime, timestampMarkers]);

  useLayoutEffect(() => {
    if (timestampMarkers.length === 0 || currentMarkerIndex < 0) {
      if (timestampMarkers.length === 0 && prevIndexRef.current !== null) {
        const root = containerRef.current ?? document;
        const prevIndex = prevIndexRef.current;
        root
          .querySelector(`[data-section-index="${prevIndex}"]`)
          ?.classList.remove("section-active");
        root
          .querySelector(`[data-marker-index="${prevIndex}"]`)
          ?.classList.remove("ts-marker-active");
        prevIndexRef.current = null;
      }
      return;
    }

    const root = containerRef.current ?? document;
    const prevIndex = prevIndexRef.current;

    if (prevIndex !== null && prevIndex !== currentMarkerIndex) {
      root
        .querySelector(`[data-section-index="${prevIndex}"]`)
        ?.classList.remove("section-active");
      root
        .querySelector(`[data-marker-index="${prevIndex}"]`)
        ?.classList.remove("ts-marker-active");
    }

    root
      .querySelector(`[data-section-index="${currentMarkerIndex}"]`)
      ?.classList.add("section-active");
    root
      .querySelector(`[data-marker-index="${currentMarkerIndex}"]`)
      ?.classList.add("ts-marker-active");

    prevIndexRef.current = currentMarkerIndex;
  }, [currentMarkerIndex, containerRef, timestampMarkers.length]);

  useLayoutEffect(() => {
    if (!autoScrollEnabled || currentMarkerIndex < 0) return;

    const root = containerRef.current ?? document;
    const markerElement = root.querySelector(
      `[data-marker-index="${currentMarkerIndex}"]`
    ) as HTMLElement | null;

    if (markerElement) {
      markerElement.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [autoScrollEnabled, currentMarkerIndex, containerRef]);

  return null;
}
