# Frontend (Vite + TanStack Router) - Developer Guide

> **Meta-Documentation Prompt for AI Agents:**
> This is the frontend-specific AGENTS.md file. It should contain:
> - TanStack Router patterns (file-based routes, params/validateSearch, guards)
> - Frontend code organization (features/, components/, routes/)
> - Type system integration (orval, type facades, snake_case conventions)
> - React Query patterns (query keys, hooks, mutations)
> - UI patterns (dialogs, forms, shadcn/ui)
> - Testing practices (ESLint, TypeScript, Cypress)
> - Build and development commands
> - Better-Auth integration (client-side usage)
>
> **Do NOT include** high-level content like:
> - Overall project architecture (belongs in `/AGENTS.md`)
> - Python backend patterns (belongs in `/fast-api/AGENTS.md`)
> - Schema migration patterns (belongs in `/go-api/AGENTS.md`)
> - Python RAG service details (belongs in `/fast-api/AGENTS.md`)
>
> When updating this file, focus on Vite/TanStack Router/React implementation details.
> Move high-level architecture to `/AGENTS.md` if needed.

---

**Stack**: Vite + TanStack Router (file-based routes, React 19) + Better-Auth + FastAPI (all CRUD + RAG/external) + Tailwind + shadcn/ui + React Query
**Type System**: FastAPI OpenAPI (snake_case) → orval → TypeScript types
**Data Access**: All data via FastAPI. The orval client calls `/rag-api/*`; `customFetch` attaches the Better-Auth JWT. In dev the Vite proxy forwards `/rag-api` + `/api/auth` to the backend (`API_URL`); in prod the static-serving nginx does.

For high-level architecture, see [`/AGENTS.md`](../AGENTS.md).

> The mobile app (`/mobile`) shares the same FastAPI OpenAPI spec — API changes require running `npx orval` there too.

---

## Architecture

**Schema Ownership**:
- ✅ **Schema migrations** are source of truth (`/go-api/migrations/*.sql`)
- ✅ **FastAPI OpenAPI** defines API contracts → orval generates TypeScript types

**Data Access**:
- **All data**: FastAPI (`/rag-api/*`, proxied by Vite in dev / nginx in prod) → PostgreSQL / external services
- **Client**: `features/*/api.ts` → orval-generated client → FastAPI
- **Auth**: Better-Auth generates JWT → FastAPI validates via JWKS
- **Caching**: React Query (in-memory; cache is not persisted across reloads)

**Commands**:
```bash
pnpm dev                    # Start dev server
pnpm generate:api           # Regenerate the orval client from the FastAPI OpenAPI spec
pnpm lint && pnpm typecheck && pnpm e2e -- --headless  # Pre-push checks
```

**Environment**:
```env
API_URL=http://localhost:8000           # Unified API URL (nginx, routes /api/auth/* to auth-server) or empty for local dev (falls back to direct service ports)
BETTER_AUTH_URL=http://localhost:3000   # Public origin (used for password-reset redirect URLs)
```

**Note on Type System**: Use generated types and clients whenever an endpoint exists in OpenAPI:
- All API types/client functions come from `@/features/rag/rag-api.generated` (FastAPI OpenAPI).
- Prefer feature facades (`types.ts`/`api.ts`) over importing the generated module throughout UI code.
- Keep manual `fetch` only for behavior OpenAPI cannot represent cleanly, such as SSE stream parsing.

---

## Folder Structure

**Separation of Concerns**:
- **`components/`**: Global, domain-agnostic UI shared across the app
- **`features/`**: Domain modules with co-located api/hooks/keys/UI
- **`hooks/`**: Cross-feature client hooks (e.g., `use-version-check`)
- **`lib/`**: Framework setup (auth, nav, fetchers, utils)
- **`routes/`**: TanStack Router file-based routes (thin — render feature page components)

**Scoping Rule**:
- Any folder (components, hooks, utils, etc.) is shared only within its directory tree.
- If something becomes more broadly useful, move it up one level.
- Feature-local UI lives in `features/[feature]/components/`.
- Tab-local UI lives in `features/[feature]/tabs/[tab-name]/components/`, with `features/[feature]/tabs/[tab-name]/index.tsx` as the tab entry point.
- Cross-feature domain UI can live in `features/shared/` (preferred over `components/` when it is domain-specific).

Notable non-obvious files: `routeTree.gen.ts` and `features/rag/rag-api.generated.ts` are generated — do not edit.

---

## Data Flow

**Data via FastAPI**:
1. Component calls query/mutation from `features/*/hooks.ts`
2. Hook calls `features/*/api.ts` fetcher
3. API file uses orval-generated client (snake_case types from `@/features/rag/rag-api.generated`)
4. `customFetch` attaches the Better-Auth JWT; the request hits `/rag-api/*` (forwarded to FastAPI by the Vite dev proxy / prod nginx)
5. FastAPI processes request
6. Response returned (snake_case)
7. Component uses data directly (no mapping)

**Type System**:
- **Single Source**: FastAPI OpenAPI → orval types (snake_case)
- **No Conversion**: Components use snake_case field access
- **No Validation**: Trust FastAPI backend validation, TypeScript compile-time checks

**Field Naming Convention**: All API data uses snake_case end-to-end (components access `source.summary_short` directly). Gotcha: capture content is `text`, not `content`.

### Design Choice: Tag refs on sources
- Source DTOs carry tag **IDs only** (`tags: [{ id }]`), matching the FastAPI payloads.
- UI resolves labels/colors via the global `useTags()` fetch (React Query); `TagMultiSelect` shows a skeleton while tags load.
- Keep source-level tag data normalized (ids only) to avoid payload bloat and reduce coupling to tag metadata changes.

---

## Type Facade Pattern

**Goal**: Decouple features from orval-generated types while maintaining type safety and ease of migration.

### Architecture

Every feature module has a `types.ts` file that acts as a **facade** between the feature and `@/features/rag/rag-api.generated`:

```
features/sources/
├── types.ts          ← ONLY file importing from @/features/rag/rag-api.generated
├── api.ts            ← Imports functions from @/features/rag/rag-api.generated, types from ./types
├── hooks.ts          ← Imports from ./types ✅
├── components/       ← Import from @/features/sources/types ✅
└── dialogs/          ← Import from @/features/sources/types ✅
```

### Enforcement

A `no-restricted-imports` ESLint rule blocks direct imports of the generated module outside `types.ts`/`api.ts`; see `eslint.config.mjs` for the authoritative ignore list (a few non-facade consumers are exempted).

### Rules

- Every feature touching generated types gets a `types.ts` re-exporting them (plus feature extensions and UI-specific types); see `features/sources/` for the reference implementation.
- Cross-feature types: import from the other feature's `types.ts`, never from the generated module.

**Refining generated fields**:

FastAPI omits `None` values in response models, and its generated OpenAPI
normalizes optional response fields to `T?`. Keep facade refinements focused on
real feature needs: tightening fields the UI knows are always present, loosening
overly specific generated metadata unions, or adding client-side enrichment.

**General rules for required vs optional** (via `extends Omit<Generated, …>` refinements):
- ✅ **Always required**: `id`, `created_at`, `updated_at`, `user_id`
- ✅ **Usually required**: Core entity fields (`title`, `label`, `text`, etc.)
- ⚠️ **Check case-by-case**: Foreign keys, nullable fields
- ✅ **Actually optional**: User-provided optional data, nullable timestamps

---

## Feature Module Pattern

All features follow the same structure for consistency. See `features/sources/` or `features/admin/` as reference implementations.

### Key Principles

- **Consistency**: Follow sources/admin patterns exactly
- **Type Facade**: Only `types.ts` and `api.ts` import from `@/features/rag/rag-api.generated`
- **Cache Optimization**: Use `initialData` for list→detail seeding
- **Split Hooks**: By domain (users.ts, stats.ts), not CRUD operations
- **Query Keys**: Always use factory, never hardcode strings

---

## UI Patterns

### Component Library

UI primitives use **Base UI** (`@base-ui/react`), not Radix. Don't assume Radix prop names.

### Dialogs

**System**: Zustand-based global dialog manager (`components/dialogs/`)

The dialog system uses a centralized Zustand store to manage dialogs globally, avoiding prop drilling and enabling type-safe dialog invocation from anywhere in the app.

**Core Files**:
- `components/dialogs/store.tsx` - Zustand store + `useDialog()` hook
- `components/dialogs/renderer.tsx` - `<DialogRenderer />` component
- `components/dialogs/index.ts` - Public API exports

**Usage**: `useDialog().openDialog(Component, props)` from anywhere; dialog components extend `WithDialogResult<T>` and resolve via `useDialogRuntime()`. See `features/sources/dialogs/` for examples.

**Gotchas**:
- Dialog results are compile-time only (TypeScript) — no runtime enforcement. For typed cancel/failure, use `openDialogResult` and resolve `{ kind: "success" | "cancel" | "failed" }`.
- The store delays cleanup by 200ms, so `closeDialog()` followed immediately by `openDialog(Next)` chains smoothly.
- Mobile-friendly sheet mode: `openDialog(MyDialog, props, { isSheet: true })`.

### Forms

**Pattern**: shadcn Form + react-hook-form + Zod. See `features/sources/dialogs/` for examples.

---

## React Query

- Query keys always come from the feature's hierarchical key factory (TkDodo pattern) — never hardcode key strings.
- Set `staleTime` per query (not global); seed detail queries from the list cache; use `select` for transformations.

---

## Barrel Export Strategy

We follow a **selective barrel export** strategy to balance clean public APIs with explicit internal dependencies.

- ✅ **Public APIs**: Use `index.ts` (barrel exports) for modules intended to be used across multiple features (e.g., `command-palette/index.ts`, `components/dialogs/index.ts`).
- ❌ **Feature Internals**: DO NOT use barrel exports for feature-internal components, hooks, or utils. Use explicit file imports instead.
- **Reasoning**: Features are self-contained; explicit imports make dependencies clearer, prevent circular dependencies, and improve tree-shaking and IDE performance.

---

## Guidelines

**Type Safety**:
- Let TypeScript infer types when possible (no unnecessary casts)
- Use orval-generated types from the FastAPI OpenAPI spec
- Use snake_case from backend throughout the frontend
- Before finishing any refactor, run `pnpm typecheck` to verify types are clean.

**Performance**:
- Prefetch on hover/focus for instant navigation (router `defaultPreload: "intent"`)
- Tune `staleTime` per query, not globally
- Use `select` for transformations (memoized)
