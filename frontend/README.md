# Frontend — Vite + TanStack Router SPA

## Architecture Overview

This is a pure client-side **Vite + TanStack Router** SPA (React 19) for the Root knowledge management system. It follows a feature-based architecture with clear separation between UI, data fetching, and business logic. In production it builds to static assets served by nginx, which proxies API paths to the backend.

### Key Technologies

- **Vite + TanStack Router** (file-based routes, React 19)
- **Better-Auth** for authentication (client-side JWT acquisition)
- **React Query** (TanStack Query) for data fetching and caching
- **Tailwind CSS + shadcn/ui** for styling and UI components
- **TypeScript** for type safety

### Data Access Architecture

All data operations go through the **FastAPI** backend (`/rag-api/*`):

1. **Requests**: The orval client calls `/rag-api/*`; `customFetch` attaches the
   Better-Auth JWT (`lib/auth/jwt.ts` mints it from the session cookie). In dev,
   Vite's proxy forwards `/rag-api` + `/api/auth` to the backend (`API_URL`); in
   prod, the static-serving nginx does.
2. **Types**: Auto-generated from FastAPI's OpenAPI spec via orval
   (`src/features/rag/rag-api.generated.ts`).

### Schema Management

- **Source of truth**: migrations in `/go-api/migrations/*.sql` (the Go service is migrations-only)
- **Type generation**: Frontend types are generated from FastAPI's OpenAPI spec
- **No manual schema edits**: Types are auto-generated, never hand-written

## Development Workflow

### Setup

```bash
pnpm install            # Install dependencies
pnpm dev                # Start the Vite dev server (localhost:3000)
```

### Making Changes

**When the FastAPI API changes:**
1. Backend regenerates `fast-api/openapi.json`
2. Frontend runs `pnpm generate:api` to regenerate TypeScript types
3. Update React Query hooks if needed

**When adding a feature:**
1. Create feature module in `src/features/<feature>/`
2. Follow the type facade pattern (see below)
3. Add API functions, hooks, and components
4. Use React Query for data fetching

### Type Facade Pattern

Each feature module has a `types.ts` file that acts as the **single import point** for API types:

```typescript
// features/[feature]/types.ts - ONLY file importing from the generated client
export type { FeatureDTO, CreateFeatureRequest } from "@/features/rag/rag-api.generated";

// All other files import from the feature's types.ts
import type { FeatureDTO } from "@/features/[feature]/types";
```

This pattern:
- Decouples features from generated types
- Makes migrations easier (change one file per feature)
- Prevents scattered imports across components
- Enforced by ESLint rules

### Routes

File-based routes live in `src/routes/` (TanStack Router; the route tree is generated into `src/routeTree.gen.ts` — don't edit it by hand). App paths are centralized in `src/lib/routes.ts`: import `routes` and use its constants/builders (`routes.library`, `routes.sourceTakeaway(id, takeawayId)`) instead of hardcoding strings in `Link` / `router.push` calls.

## Project Structure

```
src/
├── main.tsx                # SPA entry (router + providers)
├── routes/                 # TanStack Router file-based routes
│   ├── __root.tsx          # Root route (devtools, not-found)
│   ├── _authenticated.tsx  # Auth-gated layout (beforeLoad guard)
│   └── …                   # Page routes (params/validateSearch)
├── routeTree.gen.ts        # Generated route tree (do not edit)
├── components/
│   ├── dialogs/            # Dialog system (Zustand + shadcn)
│   ├── layout/             # Layout components
│   └── ui/                 # shadcn UI primitives
├── features/               # Feature modules (domain-driven)
│   └── [feature]/
│       ├── types.ts        # Type facade (imports the generated client)
│       ├── api.ts          # API client functions
│       ├── keys.ts         # React Query key factory
│       ├── hooks.ts        # React Query hooks
│       ├── pages/          # Page bodies rendered by routes
│       ├── components/     # Feature-specific UI
│       └── dialogs/        # Feature-specific dialogs
├── hooks/                  # Shared cross-feature hooks
├── lib/
│   ├── auth/               # Better-Auth client + JWT acquisition
│   ├── nav/                # Navigation facade over TanStack Router
│   ├── fetchers/           # API fetching helpers (orval customFetch)
│   └── utils/              # Shared utilities
└── features/rag/rag-api.generated.ts   # Auto-generated from FastAPI OpenAPI
```

## Key Patterns

### Data Fetching

Use React Query hooks from feature modules:

```typescript
// In a component
import { useSources, useCreateSource } from "@/features/sources/hooks";

const { data, isLoading } = useSources();
const createMutation = useCreateSource();
```

### Dialogs

Use the centralized dialog system:

```typescript
import { useDialog } from "@/components/dialogs";
import { CreateSourceDialog } from "@/features/sources/dialogs/create-source-dialog";

const { openDialog } = useDialog();
openDialog(CreateSourceDialog, { defaultType: "book" });
```

### Forms

Use shadcn Form + react-hook-form + Zod:

```typescript
const schema = z.object({ title: z.string().min(1) });
const form = useForm({ resolver: zodResolver(schema) });
```

## Best Practices

### Type Safety
- Let TypeScript infer types when possible
- Use the type facade pattern for API types
- Never manually edit generated types

### Performance
- Set appropriate `staleTime` per query
- Use `select` for data transformations
- Prefetch on hover for instant navigation

### Code Organization
- Keep features self-contained
- No barrel exports for feature internals (use explicit imports)
- Use barrel exports only for public APIs (dialogs, command-palette)

### Documentation
- Add JSDoc for complex utility functions
- Document non-obvious business logic
- Keep comments concise and relevant

## Testing

```bash
pnpm lint            # Run ESLint
pnpm typecheck       # Run TypeScript compiler
pnpm test            # Run node:test unit tests
pnpm e2e             # Run Cypress tests (headed)
```

## Related Documentation

- [Main Architecture Guide](../AGENTS.md) - System-wide architecture
- [Frontend Developer Guide](./AGENTS.md) - Detailed frontend patterns
- [Backend API](../fast-api/AGENTS.md) - FastAPI (CRUD + RAG) documentation
- [Deployment Guide](../docs/DEPLOY.md) - Dokploy / Docker deploy
