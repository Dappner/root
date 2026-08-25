"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";

import type { CaptureDTO, CitationDTO, CitationWithCapture } from "@/features/sources/types";
import type { CitationLocation } from "@/features/sources/utils/location";
import {
  buildReviewedApprovePayload,
  getSuggestionPayload,
  getSuggestionReasoning,
  type ReviewedItemDraft,
} from "@/features/suggestions/utils";
import type { SuggestionWithSource } from "@/features/suggestions/types";

import {
  useApproveSuggestion,
  useDismissSuggestion,
  useRetrySuggestion,
  useSourceReviewGroup,
} from "../../hooks";
import { captureReviewId, citationReviewId, decodeReviewId } from "./review-ids";

/** Per-item local edit state. Items keep their backend type; the reviewer edits
 *  text or drops an item — never reclassifies. */
interface ItemDraft {
  editedText: string;
  dismissed: boolean;
}

interface NoteDrafts {
  citations: ItemDraft[];
  captures: ItemDraft[];
}

/** A standalone capture (no surviving citation tie) for the active suggestion —
 *  rendered as its own row, since the transcript renderer only shows captures
 *  attached to a citation. */
export interface StandaloneReviewCapture {
  /** Synthetic review id (namespaced). */
  id: number;
  capture: CaptureDTO;
}

export interface ReviewMode {
  /** True when there is at least one suggestion (ready or failed) to step through. */
  active: boolean;
  /** True when review was entered but nothing is reviewable (no ready, no failed). */
  empty: boolean;
  /** The ready + failed suggestions being stepped through, in order. */
  suggestions: SuggestionWithSource[];
  /** True when the ACTIVE suggestion failed to process (show error + Retry, no inline items). */
  activeFailed: boolean;
  /** The active suggestion's error/reason text, when failed. */
  activeError: string | null;
  /** Re-run the matcher on the ACTIVE suggestion, optionally with steering
   *  guidance fed into the prompt, then advance. */
  retryActive: (refinement?: string) => Promise<void>;
  activeIndex: number;
  setActiveIndex: (index: number) => void;
  /** Synthetic citation id of the active suggestion's first surviving citation,
   *  for auto-scroll (or null if none). */
  activeFirstCitationId: number | null;
  /** Every ready suggestion's surviving citations (+ tied captures), namespaced,
   *  ready for HighlightedUtterances. */
  citationsWithCaptures: CitationWithCapture[];
  /** The ACTIVE suggestion's standalone captures (rendered in a small list). */
  activeStandaloneCaptures: StandaloneReviewCapture[];
  /** Edit a draft item by its synthetic review id. */
  editById: (id: number, text: string) => void;
  /** Drop a draft item by its synthetic review id (in-memory only). */
  removeById: (id: number) => void;
  /** Drop a citation draft AND every capture tied to it (remove the whole
   *  highlight + its comments). Takes a synthetic citation id. */
  removeCitationGroup: (citationId: number) => void;
  /** Approve the ACTIVE suggestion from its drafts, then advance. */
  approveActive: () => Promise<void>;
  /** Dismiss the ACTIVE suggestion, then advance. */
  dismissActive: () => Promise<void>;
  /** Skip to the next suggestion without deciding. */
  next: () => void;
  /** True once every suggestion has been decided (or none exist). */
  isDone: boolean;
  isPending: boolean;
}

function initialDrafts(s: SuggestionWithSource): NoteDrafts {
  const payload = getSuggestionPayload(s);
  if (!payload || payload.action !== "create_entities") {
    return { citations: [], captures: [] };
  }
  return {
    citations: payload.citations.map((c) => ({ editedText: c.text, dismissed: false })),
    captures: payload.captures.map((c) => ({ editedText: c.text, dismissed: false })),
  };
}

/**
 * Review-mode state for the transcript page. Holds one local-draft set per ready
 * suggestion (edit text / remove item — all in memory until Approve commits a
 * suggestion). Exposes the namespaced citation data the transcript renders, the
 * active stepper, and approve/dismiss/next actions. No bespoke screen — this
 * drives the inline review on the real transcript page.
 */
export function useReviewMode(sourceId: number, enabled: boolean): ReviewMode {
  const { suggestions: allSuggestions } = useSourceReviewGroup(sourceId, enabled);
  const approveSuggestion = useApproveSuggestion();
  const dismissSuggestion = useDismissSuggestion();
  const retrySuggestion = useRetrySuggestion();

  // Step through ready (reviewable) + failed (retryable) suggestions. Processing
  // ones are in-flight; they're skipped until they resolve.
  const suggestions = useMemo(
    () =>
      enabled
        ? allSuggestions.filter((s) => s.status === "ready" || s.status === "failed")
        : [],
    [enabled, allSuggestions],
  );

  // Drafts keyed by suggestion id, lazily seeded from each payload. Decided
  // suggestions are removed from `suggestions` upstream (cache invalidation), so
  // their stale draft entries are harmless.
  const [draftsById, setDraftsById] = useState<Record<number, NoteDrafts>>({});
  const [decided, setDecided] = useState<Set<number>>(() => new Set());
  const [activeIndex, setActiveIndex] = useState(0);

  // Resolve the draft set for the current ready suggestions, seeding any not yet
  // in state. `drafts` is memoized so downstream memos have a stable reference;
  // the seeding setState (render-phase, guarded) is React's blessed idiom for
  // state derived from props. See react.dev/learn/you-might-not-need-an-effect.
  const drafts = useMemo<Record<number, NoteDrafts>>(() => {
    const resolved: Record<number, NoteDrafts> = {};
    for (const s of suggestions) resolved[s.id] = draftsById[s.id] ?? initialDrafts(s);
    return resolved;
  }, [suggestions, draftsById]);

  const hasUnseeded = suggestions.some((s) => !draftsById[s.id]);
  if (hasUnseeded) {
    setDraftsById((prev) => {
      const next = { ...prev };
      for (const s of suggestions) if (!next[s.id]) next[s.id] = drafts[s.id];
      return next;
    });
  }

  const suggestionIndexById = useMemo(() => {
    const m = new Map<number, number>();
    suggestions.forEach((s, i) => m.set(s.id, i));
    return m;
  }, [suggestions]);

  // Build the namespaced citation/capture data for the whole source.
  const { citationsWithCaptures, activeStandaloneCaptures, activeFirstCitationId } =
    useMemo(() => {
      const cwc: CitationWithCapture[] = [];
      const activeStandalone: StandaloneReviewCapture[] = [];
      let firstActiveCitationId: number | null = null;
      const activeSuggestionId = suggestions[activeIndex]?.id;

      suggestions.forEach((s, sIdx) => {
        const payload = getSuggestionPayload(s);
        if (!payload || payload.action !== "create_entities") return;
        const noteDrafts = drafts[s.id];
        if (!noteDrafts) return;

        // Bucket surviving captures by surviving citation tie.
        const capturesByCitation = new Map<number, CaptureDTO[]>();
        payload.captures.forEach((capture, cIdx) => {
          const d = noteDrafts.captures[cIdx];
          if (!d || d.dismissed) return;
          const dto = {
            id: captureReviewId(sIdx, cIdx),
            text: d.editedText,
            source_id: sourceId,
          } as CaptureDTO;
          const tie = capture.citation_idx;
          const tieSurvives =
            tie != null &&
            tie >= 0 &&
            tie < payload.citations.length &&
            !noteDrafts.citations[tie]?.dismissed;
          if (tieSurvives) {
            const bucket = capturesByCitation.get(tie);
            if (bucket) bucket.push(dto);
            else capturesByCitation.set(tie, [dto]);
          } else if (s.id === activeSuggestionId) {
            // Standalone captures only matter for the active suggestion's side list.
            activeStandalone.push({ id: dto.id!, capture: dto });
          }
        });

        payload.citations.forEach((citation, cIdx) => {
          const d = noteDrafts.citations[cIdx];
          if (!d || d.dismissed) return;
          const id = citationReviewId(sIdx, cIdx);
          if (s.id === activeSuggestionId && firstActiveCitationId === null) {
            firstActiveCitationId = id;
          }
          const citationDto = {
            id,
            text: d.editedText,
            info_type: citation.info_type,
            source_id: sourceId,
            location: citation.location as unknown as CitationLocation,
          } as CitationDTO;
          cwc.push({ citation: citationDto, captures: capturesByCitation.get(cIdx) ?? [] });
        });
      });

      return {
        citationsWithCaptures: cwc,
        activeStandaloneCaptures: activeStandalone,
        activeFirstCitationId: firstActiveCitationId,
      };
    }, [suggestions, drafts, activeIndex, sourceId]);

  const mutateDraft = (id: number, fn: (d: ItemDraft) => ItemDraft) => {
    const { suggestionIndex, kind, payloadIndex } = decodeReviewId(id);
    const suggestion = suggestions[suggestionIndex];
    if (!suggestion) return;
    setDraftsById((prev) => {
      const note = prev[suggestion.id];
      if (!note) return prev;
      const arr = kind === "citation" ? note.citations : note.captures;
      const nextArr = arr.map((d, i) => (i === payloadIndex ? fn(d) : d));
      return {
        ...prev,
        [suggestion.id]:
          kind === "citation" ? { ...note, citations: nextArr } : { ...note, captures: nextArr },
      };
    });
  };

  const editById = (id: number, text: string) =>
    mutateDraft(id, (d) => ({ ...d, editedText: text }));
  const removeById = (id: number) => mutateDraft(id, (d) => ({ ...d, dismissed: true }));

  const removeCitationGroup = (citationId: number) => {
    const { suggestionIndex, payloadIndex } = decodeReviewId(citationId);
    const suggestion = suggestions[suggestionIndex];
    const payload = suggestion ? getSuggestionPayload(suggestion) : null;
    if (!suggestion || !payload || payload.action !== "create_entities") return;
    setDraftsById((prev) => {
      const note = prev[suggestion.id];
      if (!note) return prev;
      return {
        ...prev,
        [suggestion.id]: {
          citations: note.citations.map((d, i) =>
            i === payloadIndex ? { ...d, dismissed: true } : d,
          ),
          captures: note.captures.map((d, i) =>
            payload.captures[i]?.citation_idx === payloadIndex ? { ...d, dismissed: true } : d,
          ),
        },
      };
    });
  };

  const buildPayload = (suggestion: SuggestionWithSource) => {
    const note = draftsById[suggestion.id] ?? initialDrafts(suggestion);
    const items: ReviewedItemDraft[] = [
      ...note.citations.map((d, index): ReviewedItemDraft => ({
        kind: "citation",
        index,
        editedText: d.editedText,
        dismissed: d.dismissed,
      })),
      ...note.captures.map((d, index): ReviewedItemDraft => ({
        kind: "capture",
        index,
        editedText: d.editedText,
        dismissed: d.dismissed,
      })),
    ];
    return buildReviewedApprovePayload(suggestion, items);
  };

  const advance = () => {
    setActiveIndex((i) => {
      // Prefer the next not-yet-decided suggestion ahead, else stay.
      for (let j = i + 1; j < suggestions.length; j++) {
        if (!decided.has(suggestions[j].id)) return j;
      }
      return i;
    });
  };

  // Decide the active suggestion via `run`, marking it decided + advancing only
  // on success. On failure we toast and stay put so the user can retry — the
  // mutations themselves don't surface errors.
  const decideActive = async (
    run: (s: SuggestionWithSource) => Promise<unknown>,
    failureMessage: string,
  ) => {
    const s = suggestions[activeIndex];
    if (!s) return;
    try {
      await run(s);
      setDecided((prev) => new Set(prev).add(s.id));
      advance();
    } catch {
      toast.error(failureMessage);
    }
  };

  const approveActive = () =>
    decideActive(
      (s) =>
        approveSuggestion.mutateAsync({
          suggestionId: s.id,
          sourceId: s.source_id,
          payload: { payload: buildPayload(s) },
        }),
      "Couldn't approve — try again",
    );

  const dismissActive = () =>
    decideActive(
      (s) => dismissSuggestion.mutateAsync({ suggestionId: s.id, sourceId: s.source_id }),
      "Couldn't dismiss — try again",
    );

  const retryActive = (refinement?: string) =>
    decideActive(
      (s) =>
        retrySuggestion.mutateAsync({
          suggestionId: s.id,
          sourceId: s.source_id,
          refinement,
        }),
      "Couldn't retry — try again",
    );

  const next = () => advance();

  const activeSuggestion = suggestions[activeIndex];
  const activeFailed = activeSuggestion?.status === "failed";

  const isDone =
    enabled &&
    suggestions.length > 0 &&
    suggestions.every((s) => decided.has(s.id));

  return {
    active: enabled && suggestions.length > 0,
    empty: enabled && suggestions.length === 0,
    suggestions,
    activeFailed,
    activeError: activeFailed ? getSuggestionReasoning(activeSuggestion) : null,
    retryActive,
    activeIndex,
    setActiveIndex: (index) => {
      if (suggestionIndexById.size === 0) return;
      setActiveIndex(Math.max(0, Math.min(suggestions.length - 1, index)));
    },
    activeFirstCitationId,
    citationsWithCaptures,
    activeStandaloneCaptures,
    editById,
    removeById,
    removeCitationGroup,
    approveActive,
    dismissActive,
    next,
    isDone,
    isPending:
      approveSuggestion.isPending ||
      dismissSuggestion.isPending ||
      retrySuggestion.isPending,
  };
}
