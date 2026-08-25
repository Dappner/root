# TODOs

## Cross-cutting

### Feature

- Recall eligibility: in-progress sources should not be eligible for recall
  (status state machine already exists; wire eligibility into recall queries).
- Short summary generated using AI.
  - UX question: on demand, on change? Function of the user summary.
- Allow clearing source `published_at` (backend + frontend) without a custom
  DTO.
- Multi-page PDF citations (FE and BE behavior — currently validated same-page
  in Go).

### UX

- Rethink add-podcasts / add-videos UX in Root end-to-end.
  - Today: episode-by-episode import + an Apple-podcast lookup; channels/shows
    live in a discover page; the relationship between "discover a show", "add an
    episode", and "track a feed for new episodes" is implicit. Decide what the
    first-class verb is (subscribe to show? import episode? track channel?), and
    design entry points + feeds around that.
- Better Sources Page
  - Quick links to "Active" or recent sources.
- Better Home Page.
- Command Palette improvements
  - Recency search on sources.
  - Currently using `localStorage` for source visit tracking (recency + visit
    count). Migrate to backend storage for cross-device sync.

### Technical

- Better data flow (cross-service).
- Entire RAG system FE ↔ BE interaction (full review).
- I still think the way we do citations is a little scuffed / iffy.
- Advanced dialog system (draft cache on API error, deep-equal props keying,
  `localStorage` persistence).
- Normalize `sha256` column names across candidate tables.
  - Today each candidate table names its raw-text hash differently:
    `citations.text_sha256`, `captures.content_sha256`,
    `source_sections.summary_sha256`, `source_takeaways.content_sha256`.
  - Same semantic role (hash of the primary text we embed), four names. Forces
    every cross-kind query (stale-embeddings scan, etc.) to special-case per
    table.
  - Proposed: rename all to `content_sha256` (or pick a single name and stick to
    it). Touches Go migrations, sqlc queries, FastAPI repos/services, and any
    frontend types that surface the column.
- Rename `captures` table → `comments`.
  - Current name is a leftover from earlier scoping; "capture" is now the
    user-facing concept that the table no longer matches (a capture is
    conceptually a comment on a citation/source).
  - Touches: migration, sqlc, all Go services/handlers/DTOs, FastAPI
    models/repos/services/schemas, frontend `features/captures/` (consider also
    renaming the feature directory), mobile generated types.
  - Worth bundling with the sha-column rename since both are schema-rename churn
    that should regenerate types once.
- Embedding staleness misses source-metadata drift.
  - `rag_embeddings.content_sha256` stores the candidate's raw-text hash
    (`citations.text_sha256`, `captures.content_sha256`,
    `source_sections.summary_sha256`, `source_takeaways.content_sha256`).
  - The Voyage document we embed also includes source metadata (title, author,
    podcast/show, video channel, etc.). So if a user renames a source, the
    embedded document changes but the raw-text hash doesn't — the row looks
    healthy and stale-scan won't flag it.
  - Accepted for now: source metadata rarely changes meaningfully for retrieval.
  - If we want to fix: either (a) add a `document_sha256` column to each
    candidate table and keep it fresh on source edits + embed writes, or (b)
    recompute SHA256(document) per candidate during stale scan. (a) is
    cheap-scan + needs a migration; (b) is zero-schema but O(N) Python per scan.
- Check CORS settings to ensure they are MORE STRICT.
- When is the complexity of queues worth it? Redis? What else? Want to deploy it
  myself.
- Finish migrating source CRUD to FastAPI so the dual-`SourceDTO` boundary can
  go.
  - Today there are two generated `SourceDTO`s (Go uses `T | undefined`, FastAPI
    uses `T | null`). Anywhere a FastAPI response feeds a Go-DTO-typed component
    we have to bridge.
  - Bridges to remove once Go's SourceDTO is retired:
    - `mobile/features/podcasts/api.ts` — `addToLibrary` runs
      `nullToUndefined()` + `as unknown as SourceDTO`. Drop both, plus the
      helper file `mobile/lib/api/null-to-undefined.ts`.
    - `frontend/src/features/home/components/in-progress-strip.tsx` (and other
      home/discover surfaces that cast FastAPI source data into the Go shape).
    - `project_source_dto_dual` memory note can be deleted at that point.
  - Blocker: source CRUD endpoints (`listSources`, `getSource`,
    create/update/delete, sections) still live in Go.

---

## fast-api (Python)

### Feature

- Re-engineer RSS parsing and upserting for podcasts.
  - Today: `podcast_sync_service` does a one-shot fetch (50 MB cap, 20 s
    timeout), parses with `defusedxml`, upserts the show row, dedupes episodes
    by `(show_id, episode_guid)`. No retries, no etag/if-modified-since, no
    scheduling, no partial-failure surfacing. Decide on cadence (cron vs
    on-demand vs both), conditional GETs to avoid re-downloading unchanged
    feeds, error visibility to the user (last-sync status), and how this
    composes with the future "subscribe to show" flow.
- Better RAG actions → e.g. search by source type, etc.

### Technical

- Unify playback timestamps into a single `last_played_at`.
  - `PlaybackService.update_progress` currently branches on `source.type`,
    writing `metadata.last_watched_at` for video and `metadata.last_listened_at`
    for everything else. Same semantic role ("when did the user last play this"),
    two keys — forces every reader to special-case per source type.
  - Proposed: migrate existing `last_watched_at` / `last_listened_at` values into
    one `last_played_at` (in source `metadata_json`, or promote to a real column),
    then have playback write only that. Drop the type branch in the service.
  - Touches: a data migration over `sources.metadata_json`, the playback service,
    and any FE/mobile reader of `last_watched_at` / `last_listened_at`.
- Standardize the voice (ElevenLabs) endpoints' error contract.
  - `/voice/elevenlabs/signed-url` and `/voice/elevenlabs/conversation-token`
    currently raise raw `HTTPException` (503 for missing config, 502 for upstream
    failures) and leak the provider response — the 400-from-upstream path returns
    a structured `detail` dict (`{message, elevenlabs_status, elevenlabs_body}`).
  - These are the only routes that don't go through the central domain-exception
    handler (`ExternalServiceError` → 503 + standard problem-detail body).
  - Left as-is for now to avoid a surface change: the mobile client
    (`mobile/features/voice-agent/api.ts`) reads `response.status` + raw text on
    failure, so switching to the standard handler would alter status codes/body.
  - The integration call now lives in `integrations/elevenlabs.py` + a service;
    only the route's error-raising is unchanged. When standardizing, update the
    mobile error handling in the same pass.
- PDF: whole file is loaded into memory → technically a vulnerability. E.g. 10 ×
  50 MB files → 500 MB memory.
- Better generic caching mechanisms (e.g. PDF cache so no re-request).
- Move retrieval from FastAPI to Go (long term, when worth it).

#### Rerank 2.5 instruction-following

- Phase 1 (static action-level instructions): **done** — `rerank-2.5` +
  per-action `rerank_instruction` in place.
- Phase 2: Dynamic instruction generation (future)
  - [ ] Query intent detection: parse query patterns to generate instructions
        ("What did X say about Y?" → "Prioritize direct quotes with speaker
        attribution"; "What do I think about Y?" → "Prioritize user's personal
        reflections"; factual questions → "Prioritize statistics and facts over
        opinions").
  - [ ] Metadata-driven instructions: emphasize recency, source type, or
        speaker.
  - [ ] Citation-type disambiguation: factual queries → prioritize statistics;
        opinion queries → prioritize quotes/paraphrases.
- Phase 3: User-configurable instructions (future)
  - [ ] Standing instructions: persistent reranking preferences (frontend
        settings; per-source).
  - [ ] Query-level instructions: frontend passes custom instructions per query.
  - [ ] Instruction templates: library of reusable patterns.
- Measurement & evaluation (future)
  - [ ] Logging: log reranking instructions and score changes per query.
  - [ ] Metrics: precision@k, recall@k before/after instructions.
  - [ ] A/B testing on representative queries.
  - [ ] User feedback: collect relevance ratings.

#### Retrieval — future / lower priority

- Identifier/phrase handling for lexical leg.
  - Detect quoted spans/all-caps tokens; route them through `phraseto_tsquery`
    or `simple` config to avoid stemming.
  - Add `pg_trgm` exact-ish fallback when BM25/FTS return empty; merge those
    hits with fusion.
  - Keep English stemming for general terms.
- Query bifurcation (keyword vs semantic).
  - In Jetflow search actions, derive two queries: raw/keyword (preserve
    quotes/IDs) for BM25/FTS, and cleaned/rephrased for embeddings.
  - Pass both to `hybrid_search`; lexical side uses keyword string, embedding
    side uses semantic string. Default `keyword_query` to user text to avoid
    breakage.
- Score blending before/with RRF.
  - Normalize scores per signal (min-max or z-score) and blend (e.g.,
    `alpha*semantic + (1-alpha)*bm25`).
  - Use blended score as an alternative to pure rank-based RRF when ranks are
    unstable; keep RRF as baseline.
- Logging/telemetry.
  - Per query, log which signal returned each hit, raw scores, normalized
    scores, and final rank.
  - Eval/smoke queries: `error PG-1234` (BM25 should win),
    `why is my database slow` (vector-only), `fix connection timeout` (both).
    Track recall@k / precision@k for vec, BM25, fusion.


- FIX SUGGETION MATCHING

#### Testing

- More testing.
- Improve smoke test.
- Ensure edge cases around PDF size etc. are thought through.
- TODO: If PDF metadata exists but the R2 object is missing, decide on a
  reconciliation strategy (e.g., clear metadata on upload or surface a repair
  action).
- When do we bother moving to something like Pinecone?

---

## frontend (Next.js)

### Feature / UX

- Rework citation locations end-to-end (API → generated types → FE usage).
  Includes fixing `CreateCitationRequest.location` typing and unifying
  PDF/transcript schemas. (HIGH PRIO.)
- Then simplify `CitationDialog` by adding modes
  - create, update
  - manual, derived
  - In the manual flow, users can add a location and the location fields are
    determined by the source type.
  - In the automatic flow, location is prefilled by e.g. the PDF location
    (coordinates), or the JSON payload for the transcript stuff → in that flow
    users can't mess with the citation.
- Decide on optimistic citation UX failure behavior (e.g., reopen dialog with
  draft + toast, or inline retry affordance).

### Technical — React Query cleanup

- Over-broad invalidations: narrow mutation invalidations
  (sources/citations/sections/captures/takeaways) to only the queries that need
  refresh; prefer `setQueryData` where possible.
- Unscoped invalidations: replace blanket `invalidateQueries()` calls (e.g.,
  `create-capture-dialog`, `move-highlight-dialog`) with explicit keys to avoid
  nuking the cache/persistence.
- Redundant invalidations after optimistic updates: section updates currently
  `setQueryData` then invalidate the same queries; remove duplicate
  invalidations or keep a single targeted one.
- Polling churn: gate/refine the 2 s `refetchInterval` in `useSource`
  (enrichment) with visibility/backoff or a max duration to avoid long-running
  polling.
- Key consistency: use key factories instead of manual array spreads to prevent
  cache splits.
- Query-layer transforms: move sorting/derivation into
  `select`/`placeholderData` for takeaways/captures (and others) to reduce
  render work and persisted snapshot size.
- Persistence hygiene: add `persistOptions.shouldDehydrateQuery` to skip
  large/ephemeral queries (e.g., search results) so IndexedDB writes stay lean.
- Reorder batching: in `SourceSectionsTab`, consider batching/debouncing reorder
  mutations or optimistically updating cache before server calls to reduce
  chatter during rapid moves.
- [ ] Version-based cache busting: for Dokploy, add a reliable buster source
      (e.g., `NEXT_PUBLIC_DEPLOY_VERSION` env) or clear caches when
      `useVersionCheck` detects a new version (`queryClient.clear` +
      `persister.removeClient`).

### Technical — Too-large queries

- Highlight DTO queries are getting too big for cache invalidation etc.
- We should sub-sort under sections (high-level ones).

### Technical — RAG source mentions styling

- Issue: react-mentions (`@[Display](id)` markup) not applying
  `.mentions-input__mention` CSS class correctly — mentions render as plain text
  instead of styled chips in the input field.
- Current workaround: using inline `style` prop on `Mention` component
  (partially working).
- Note: Mentions are functional (stored correctly, autocomplete works), but
  visual styling in the input isn't perfect. Chat display (`<source-id:N>` →
  styled chips) works correctly.
- TODO: Investigate react-mentions class-name generation or consider alternative
  approach for mention styling.

### Technical — Code organization

- The citation-dialog logic is getting too complicated → check e.g.
  `left-column.tsx`.
- Most of it is now overcomplicated. Either we make these different forms that
  compose from basic components (simpler but more code), or… not sure yet.

---

## Infrastructure / Ops

### Technical

- Queues and workers: when is the complexity worth it? Redis? Want to deploy it
  myself.
