"use client";

import { memo } from "react";
import type { TranscriptUtterance } from "@/features/podcasts/types";

interface UtteranceSpanProps extends React.HTMLAttributes<HTMLSpanElement> {
  utterance: TranscriptUtterance;
  index: number;
  children: React.ReactNode;
}

/**
 * Renders a single utterance with data attributes for DOM-based selection capture.
 * This enables 100% reliable timestamp extraction when creating citations.
 * Memoized to prevent re-renders when unrelated state changes.
 */
export const UtteranceSpan = memo(function UtteranceSpan({
  utterance,
  index,
  children,
  ...props
}: UtteranceSpanProps) {
  return (
    <span
      {...props}
      data-utterance-idx={index}
      data-start-time={utterance.start}
      data-end-time={utterance.end}
    >
      {children}
    </span>
  );
});
