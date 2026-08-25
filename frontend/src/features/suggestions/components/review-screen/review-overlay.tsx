"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { RotateCcw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { flashElement } from "@/features/sources/pages/source-transcript-page-utils/flash-element";
import { usePathname, useRouter, useSearchParams } from "@/lib/nav";

import type { ReviewMode } from "./use-review-mode";
import { getSuggestionMetaLine } from "@/features/suggestions/utils";

interface ReviewOverlayProps {
  review: ReviewMode;
  /** Transcript container, scopes the auto-scroll mark lookup to the inline body. */
  containerRef: React.RefObject<HTMLDivElement | null>;
}

/**
 * Floating top-right stepper for `?review=1`. Drives `useReviewMode`'s
 * approve/dismiss/next, auto-scrolls to the active suggestion's first citation
 * on each step, and on completion strips `?review` so the page falls back to the
 * saved transcript view. Sits above the xl `CaptureGutter` (higher fixed layer).
 */
export function ReviewOverlay({ review, containerRef }: ReviewOverlayProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const exitedRef = useRef(false);
  // Bumped on every step so the scroll re-fires even when the active suggestion
  // (and its citation id) doesn't change — e.g. hitting Next on the last/only one.
  const [scrollTick, setScrollTick] = useState(0);
  const [refining, setRefining] = useState(false);
  const [refineText, setRefineText] = useState("");

  const { activeIndex, activeFirstCitationId, suggestions, isDone, isPending, empty, activeFailed, activeError } = review;

  // Scroll the active suggestion's first surviving citation into view + flash it.
  // Mirrors `scrollToLastHighlight`; the setTimeout lets the mark settle first.
  useEffect(() => {
    if (activeFirstCitationId === null) return;
    const id = activeFirstCitationId;
    const timer = setTimeout(() => {
      const selector = `[data-citation-kind="mark"][data-citation-id="${id}"]`;
      const container = containerRef.current;
      const el = (container
        ? container.querySelector(selector)
        : document.querySelector(selector)) as HTMLElement | null;
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        flashElement(el);
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [activeFirstCitationId, activeIndex, scrollTick, containerRef]);

  // Reset the refine box when stepping to another suggestion (render-phase
  // compare, not an effect, to avoid a cascading-render lint/perf hit).
  const [refineForIndex, setRefineForIndex] = useState(activeIndex);
  if (refineForIndex !== activeIndex) {
    setRefineForIndex(activeIndex);
    setRefining(false);
    setRefineText("");
  }

  // Step handlers: run the review action, then re-trigger the scroll effect so
  // the transcript follows even when the index stays put.
  const step = useCallback(
    (action: () => void | Promise<void>) => {
      void Promise.resolve(action()).finally(() => setScrollTick((t) => t + 1));
    },
    [],
  );

  // Exit review (drop `?review`, guarded to run once) when everything's decided,
  // or immediately when there was nothing to review. The latter toasts so the
  // user isn't dumped onto a plain transcript with no explanation.
  useEffect(() => {
    if (exitedRef.current || (!isDone && !empty)) return;
    exitedRef.current = true;
    if (empty) toast("Nothing to review here");
    const params = new URLSearchParams(searchParams);
    params.delete("review");
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  }, [isDone, empty, pathname, router, searchParams]);

  if (!review.active || isDone) return null;

  const activeSuggestion = suggestions[activeIndex];
  const meta =
    activeSuggestion && !activeFailed ? getSuggestionMetaLine(activeSuggestion) : "";

  const runRefine = () => {
    const text = refineText.trim();
    step(() => review.retryActive(text || undefined));
    setRefineText("");
    setRefining(false);
  };

  return (
    <div className="fixed right-4 top-20 z-[60] w-72 animate-in fade-in slide-in-from-top-2 rounded-lg border bg-card p-3 shadow-lg">
      <p className="text-sm font-medium text-foreground">
        Suggestion {activeIndex + 1} / {suggestions.length}
      </p>
      {activeFailed ? (
        <p className="mt-0.5 text-xs text-destructive">
          {activeError ?? "This note failed to process."}
        </p>
      ) : (
        meta && <p className="mt-0.5 text-xs text-muted-foreground">{meta}</p>
      )}

      <div className="mt-3 flex items-center gap-2">
        {activeFailed ? (
          <Button
            size="sm"
            className="flex-1"
            disabled={isPending}
            onClick={() => step(review.retryActive)}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Retry
          </Button>
        ) : (
          <Button
            size="sm"
            className="flex-1"
            disabled={isPending}
            onClick={() => step(review.approveActive)}
          >
            Approve
          </Button>
        )}
        <Button
          size="sm"
          variant="outline"
          disabled={isPending}
          onClick={() => step(review.dismissActive)}
        >
          Dismiss
        </Button>
        <Button size="sm" variant="ghost" disabled={isPending} onClick={() => step(review.next)}>
          Next
        </Button>
      </div>

      {refining ? (
        <div className="mt-3 space-y-2">
          <Textarea
            autoFocus
            value={refineText}
            onChange={(e) => setRefineText(e.target.value)}
            placeholder="Guide the redo — e.g. 'these are two separate thoughts', 'focus on the capex point'…"
            className="min-h-16 text-xs"
            disabled={isPending}
          />
          <div className="flex items-center justify-end gap-2">
            <Button
              size="sm"
              variant="ghost"
              disabled={isPending}
              onClick={() => {
                setRefining(false);
                setRefineText("");
              }}
            >
              Cancel
            </Button>
            <Button size="sm" disabled={isPending} onClick={runRefine}>
              <RotateCcw className="h-3.5 w-3.5" />
              Refine &amp; retry
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          disabled={isPending}
          onClick={() => setRefining(true)}
          className="mt-2 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
        >
          Refine with guidance…
        </button>
      )}
    </div>
  );
}
