# Copilot Instructions for Root

## Project Overview

Root is a knowledge management system for capturing, synthesizing, and recalling insights from reading. It features:

- **Frontend**: Next.js 16 with Better-Auth, React Query, and shadcn/ui
- **Backend**: Go with Chi router, sqlc, PostgreSQL (CRUD operations, business logic)
- **Fast API**: Python with FastAPI for external service integration (R2, AssemblyAI, YouTube, LLMs) and AI operations
- **Auth**: Better-Auth (Next.js) generates JWTs validated by both Go and Python backends via JWKS

## Architecture

### High-Level Flow

```
User → Next.js Frontend → Go API → PostgreSQL
                        ↓
                   Better-Auth (JWT)
                        ↓
                   Go Backend (validates JWT via JWKS)
```

### Key Directories

- `/go-api` - Go backend (Chi router, sqlc) - CRUD operations, business logic
- `/fast-api` - Python FastAPI service - External service integration (R2, AssemblyAI, YouTube, LLMs) and AI operations
- `/frontend` - Next.js 16 app (App Router, React 19, Better-Auth)
- `/go-api/migrations` - SQL migrations (single source of truth for schema)

## Development Guidelines

### Before Making Changes

**ALWAYS** read the relevant documentation first:

- Backend changes → `/go-api/CLAUDE.md`
- Frontend changes → `/frontend/CLAUDE.md`
- General architecture → `/CLAUDE.md`

### Data Access Patterns

**All data operations** go through the Go API:

- Frontend makes requests to Go API endpoints
- Go API handles all reads and writes to PostgreSQL
- Types from OpenAPI/Swagger → `src/api/generated.ts`

### Type Safety

**Frontend**:

- Single source of truth: Go backend Swagger/OpenAPI
- Everything is snake_case from backend
- Use `customFetch`/orval for Go endpoints (Problem+JSON aware)
- TailwindCSS uses newest version: e.g. this is correct syntax "!select-text !inline"

**Backend**:

- Use sqlc for type-safe SQL queries
- Domain models in `internal/domain/`
- DTOs in `internal/transport/http/dto/`
- Always add Swagger annotations for API endpoints

### Schema Changes

**CRITICAL**: Go migrations are the single source of truth!

1. Create migration: `go-api/migrations/000X_description.up.sql`
2. Run migration: `make migrate-up` (in `/go-api`)
3. Update queries: `go-api/queries/*.sql` (if using sqlc)
4. Generate Go code: `sqlc generate` (in `/go-api`)

### API Changes

**Backend**:

1. Update handler with Swagger annotations
2. Run `make swagger` to regenerate spec
3. Frontend: Run `pnpm generate:api` to regenerate TypeScript types

### Authentication

- Better-Auth manages users/sessions in `auth.*` schema
- JWT tokens signed with private key in `auth.jwks` table
- Next.js proxy adds `Authorization: Bearer <token>` header
- Go backend validates via JWKS endpoint (`/api/auth/jwks`)
- Extract user context from JWT claims (id, email, name)

### Code Organization

**Backend (Go)**:

- **Handler** → Parses HTTP, calls services
- **Service** → Business logic, uses store pattern
- **Store** → Aggregates repositories, provides transactions
- **Repository** → Data access, SQL queries
- **Domain** → Pure structs, no dependencies

**Frontend (Next.js)**:

- Feature modules in `src/features/*` (co-located api, hooks, keys, components)
- Shared UI in `src/components/`
- React Query hooks for data fetching
- Query key factories for cache management

### Testing & Quality

**Backend**:

```bash
cd go-api
make test          # Unit tests
make integTest     # Integration tests
```

**Frontend**:

```bash
cd frontend
pnpm lint          # ESLint
pnpm type-check    # TypeScript
pnpm e2e           # Cypress tests
```

### Environment Setup

**Root environment** (Backend Services)

Environment variables managed via Doppler:

```bash
DATABASE_URL=postgres://postgres:password@localhost:5432/db?sslmode=disable
FRONTEND_URL=http://localhost:3000  # For JWKS endpoint
```

Run commands with: `doppler run -- <command>`

**Frontend `.env.local`**:

```bash
DATABASE_URL=postgres://...
BETTER_AUTH_SECRET=...
BETTER_AUTH_URL=http://localhost:3000
API_URL=  # Empty for local dev (defaults to localhost:8080/8081), or set to nginx URL
```

## Common Patterns

### Adding a New Feature

1. **Backend**:
   - Add domain model in `internal/domain/`
   - Create repository in `internal/repo/`
   - Add repository to store in `internal/store/`
   - Implement service in `internal/service/`
   - Add handler in `internal/transport/http/handler/`
   - Add DTOs in `internal/transport/http/dto/`
   - Register route in `internal/transport/http/router.go`
   - Add Swagger annotations
   - Run `make swagger`

2. **Frontend**:
   - Create feature module in `src/features/<feature>/`
   - Add fetchers in `src/features/<feature>/api.ts`
   - Add query keys in `src/features/<feature>/keys.ts`
   - Add React Query hooks in `src/features/<feature>/hooks.ts`
   - Run `pnpm generate:api` to update TypeScript types from Swagger

### Cache Invalidation

After Go API writes, invalidate Next.js cache:

```typescript
import { revalidatePath } from 'next/cache';

const response = await fetch('/api/go-api/sources', { method: 'POST', ... });
if (response.ok) {
  revalidatePath('/sources');
}
```

## Best Practices

### DO

- ✅ Read relevant CLAUDE.md files before making changes
- ✅ Add Swagger annotations to Go endpoints
- ✅ Filter by userId in all database queries
- ✅ Use React Query for client-side data fetching
- ✅ Run migrations via Makefile, not in code
- ✅ Use store pattern for cross-repo transactions
- ✅ Add Problem+JSON error handling in Go

### DON'T

- ❌ Create frontend database access (all data via Go API)
- ❌ Skip Swagger annotations on API endpoints
- ❌ Filter by userId only in route guards
- ❌ Use blanket cache invalidations
- ❌ Access repos directly (use store pattern)
- ❌ Run migrations in application code

## Quick Reference

| Task | Command |
|------|---------|
| Start backend | `cd go-api && make dev` |
| Start frontend | `cd frontend && pnpm dev` |
| Run migrations | `cd go-api && make migrate-up` |
| Generate API types | `cd frontend && pnpm generate:api` |
| Generate Swagger | `cd go-api && make swagger` |
| Generate sqlc | `cd go-api && sqlc generate` |
| Run backend tests | `cd go-api && make test` |
| Run frontend linter | `cd frontend && pnpm lint` |
| Run type checks | `cd frontend && pnpm type-check` |
| Run E2E tests | `cd frontend && pnpm e2e` |

## Related Documentation

- [Main Architecture Guide](/CLAUDE.md)
- [Backend Developer Guide](/go-api/CLAUDE.md)
- [Frontend Developer Guide](/frontend/CLAUDE.md)
- [Deployment Guide](/DEPLOY.md)
- [Project README](/README.md)
