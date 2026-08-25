# Suggestion Review on the Transcript Page — Spec

> Status: approved, not yet implemented (June 2026). Replaces the bespoke
> `/suggestions/review` full-screen reviewer.

## Model

Review mode **is** the real source transcript page (`/library/[itemId]/transcript`)
rendered with `?review=1`. Pending voice-note suggestions render inline in the
transcript (low opacity, "proposed"); a floating top-right **overlay** steps
through them (**one suggestion = one step**, "X / N") with **Next / Dismiss /
Approve**, auto-scrolling to the next on action, and disappears when done.

All edits and removals are **in-memory drafts** (`use-review-session`) until
**Approve** commits a suggestion (`buildReviewedApprovePayload` → existing
`useApproveSuggestion`). Nothing hits the server before Approve — removing a
suggestion capture/citation just drops it from the draft.

## Locked decisions

- **Entry (`?review=1`):**
  - Home `SuggestionsHeaderPill` → `/suggestions` list (UNCHANGED — list is the inbox).
  - `/suggestions` list per-source "Review" (`source-group-row` → `handleReview`) → `/library/<sourceId>/transcript?review=1`.
  - Source overview `SourceSuggestionsNudge` "Review" → same route (drop the `SourceSuggestionsSheet` it opens today).
- **Renders:** ALL ready suggestions' items inline at once, low opacity; the ACTIVE one (overlay's X/N) full-opacity + subtle ring.
- **Step unit:** one suggestion. X/N counts **ready** suggestions only; failed/processing are skipped in review mode (still visible/retryable on the list).
- **Citation edit:** click the highlighted mark → inline textarea editor → draft. Capture edit/remove already wired via `mode="suggestion"` on `InlineCaptureCard` + `HighlightedUtterances`.
- **Delete:** in-memory `toggleDismiss` only (item was never persisted).
- **Editing always-live;** Approve commits current draft state. No separate edit/save step. No approve gating.
- **On finishing the last ready suggestion:** overlay disappears, stay on the transcript (now showing approved citations as saved), drop `?review=1` from the URL.

## Phases

- **A — hooks:** new `useReviewMode(sourceId, enabled)` in `features/suggestions/hooks.ts`. Wraps `useSourceReviewGroup` (ready-only), holds `activeIndex` + a per-suggestion `useReviewSession`, exposes `{ suggestions, activeIndex, setActive, sessions, approveActive, dismissActive, next, isDone }`. Approve/dismiss reuse existing mutations; advance + signal scroll. Adapter `suggestion-to-citations.ts` produces pending `CitationWithCapture[]` per suggestion, tagged `suggestionId` + `isActive`.
- **B — page merge:** `SourceTranscriptPage` builds the review bundle when `?review=1` + ready suggestions exist, passes to `ContinuousTranscriptDisplay` (new optional `review` prop). It merges pending `CitationWithCapture[]` into `HighlightedUtterances` with `mode="suggestion"` + draft callbacks. Pending marks get `data-suggestion` / `data-suggestion-active` + click-to-edit. **Saved path unchanged when no review prop.**
- **C — visual:** CSS for `[data-suggestion]` (low opacity / dashed) and `[data-suggestion-active]` (full + ring); `CitationMark` gains `mode="suggestion"` (click→edit draft, remove→draft).
- **D — overlay:** `review-overlay.tsx` top-right in the transcript scroll container (avoid xl capture-gutter collision). "Suggestion X / N" + meta + Next/Dismiss/Approve. Drives `useReviewMode`; on step scroll active suggestion's first citation into view (reuse `[data-citation-id]` scrollIntoView + flash). Auto-hide on `isDone` + strip `?review`.
- **E — re-point & delete:** re-point list `handleReview` + nudge. Delete `/suggestions/review` route, `review-screen.tsx`, `transcript-workspace.tsx`, `note-top-bar.tsx`, `source-suggestions-sheet/*`. Keep adapter, `use-review-session`, `buildReviewedApprovePayload`, `hooks.ts`.
- **F — verify:** typecheck, lint, `test:suggestions`; saved transcript view byte-identical when `?review` absent; manual run-through.

## Routing reality (IMPORTANT — branch is mid Next→TanStack migration)

This branch runs Next App Router (`src/app/...`) and TanStack Router
(`src/routes/...`) side by side. **Target TanStack** (the future). The TanStack
transcript route (`src/routes/_authenticated/library/$itemId/transcript.tsx`)
reuses the SAME `SourceTranscriptPage` + `ContinuousTranscriptDisplay`
components as the Next route — so Phases B/C/D are router-agnostic component work.

Use the **`@/lib/nav` shim** for all navigation/search (dual-impl over both
routers, Next-compatible API):
- read `?review`: `useSearchParams()` from `@/lib/nav` → `URLSearchParams` (`.get("review")`).
- navigate (entry points, drop-param on finish): `useRouter()` from `@/lib/nav` → `.push(href)` / `.replace(href)`.
- `usePathname()` + `Link` also available. Mirror `library-page.tsx`, which already imports these from `@/lib/nav`.
Do NOT import from `next/navigation` or `@tanstack/react-router` directly in feature code. No TanStack `validateSearch` needed for `?review` — the shim's `useSearchParams` handles it.

## Risk

`ContinuousTranscriptDisplay` + `HighlightedUtterances` are shared with the live
transcript view. EVERY change must be gated on the review prop/mode; absent it,
zero behavioral change to the saved transcript view.
