# Public Profiles & Visibility Model

Design proposal for public sharing in Root with explicit per-entity visibility controls.

**Last Updated:** February 20, 2026
**Status:** Draft (proposed)

---

## Goals

- Allow users to share selected knowledge artifacts publicly.
- Keep private-by-default behavior as the safe default.
- Support both in-app feed visibility and fully public profile visibility.
- Make it hard to accidentally leak private notes.

## Non-Goals (V1)

- Real-time collaboration.
- Per-follower custom ACLs.
- Rich social graph/ranking algorithms.

---

## Visibility Enum

Use an enum (not boolean):

- `none` - owner-only, not shown in feed/public surfaces.
- `feed` - visible in in-app feed/discovery surfaces, not publicly linkable.
- `public` - visible on public profile/share pages and eligible for feed/discovery.

Default for all entities: `none`.

---

## Entities in Scope

Start with:

- `sources`
- `sections` (optional in V1, recommended in V2)
- `citations`
- `captures`
- `source_takeaways`

Each gets a `visibility` enum column.

---

## Effective Visibility Rules

Visibility should be bounded by parent visibility.

Order:

- `none < feed < public`

Rule:

- `effective_visibility = min(entity.visibility, parent.effective_visibility)`

Examples:

- Source `none`, Citation `public` -> Citation effective visibility is `none`.
- Source `feed`, Capture `public` -> Capture effective visibility is `feed`.
- Source `public`, Takeaway `feed` -> Takeaway effective visibility is `feed`.

This prevents child records from being more exposed than their parent source.

---

## API Contract (Proposed)

Owner endpoints (authenticated):

- Existing read/write APIs remain owner-complete.
- Add visibility fields to DTOs and update payloads.

Public endpoints (read-only):

- `GET /public/:handle`
- `GET /public/:handle/sources`
- `GET /public/:handle/sources/:sourceId`

Feed endpoints (authenticated, optional V1.5):

- `GET /feed` returns entities with effective visibility `feed` or `public`.

All public/feed queries must filter by `effective_visibility` only.

---

## UI/UX

V1 controls:

- Source-level visibility selector (`none`, `feed`, `public`).
- Per-item quick override on citations/captures/takeaways.
- Public preview mode to show exactly what others can see.

Safety defaults:

- New content defaults to `none`.
- First-time public publish shows confirmation modal with checklist.

---

## Migration Plan

1. Add enum type + `visibility` columns (default `none`) to scoped tables.
2. Backfill existing records to `none`.
3. Update owner DTOs and mutation schemas.
4. Add effective visibility filtering utilities in Go services.
5. Add public profile read APIs.
6. Add frontend visibility controls and preview mode.

---

## Security & Privacy Guardrails

- Never return `none` entities from public/feed endpoints.
- Re-check ownership/visibility server-side for all responses.
- Add tests for cross-entity leakage cases (parent `none`, child `public`).
- Audit logs for visibility changes (who changed what and when).

---

## Open Questions

- Should `feed` content be visible to all authenticated users or followers-only?
- Do we need separate profile-level default visibility preferences?
- Should sections be explicitly shareable in V1 or inherit-only from source?
- Do we need `unlisted` later (`link-only`, not indexed)?

---

## Related Docs

- `docs/ROADMAP.md`
- `docs/product_overview.md`
- `docs/product_philosophy.md`
