# Root - Knowledge Management System

> **Meta-Documentation Prompt for AI Agents:**
> This is the root AGENTS.md file. It should contain high-level information:
> - Project purpose and major features
> - Architecture overview (service interactions, auth flow)
> - Environments and deployment overview
> - Cross-service constraints (shared env vars, compose updates)
>
> Avoid deep implementation details (code patterns, testing commands, build scripts).
> Those belong in nested AGENTS.md files:
> - `/fast-api/AGENTS.md` - Python backend (CRUD + RAG) specifics
> - `/frontend/AGENTS.md` - Vite frontend specifics
> - `/go-api/AGENTS.md` - Go migration runner / schema migration specifics
> - `/mobile/AGENTS.md` - Expo React Native app specifics

---

## Overview

Root is a knowledge management system that helps users capture, synthesize, and recall insights from their reading, podcasts, youtube videos and more.

- **Vite Frontend** (`/frontend`) - SPA (Vite + TanStack Router, React 19) - UI and user experience
- **Auth Server** (`/auth-server`) - Dedicated Better-Auth service (Hono on Bun): sessions, JWTs, JWKS, admin user management, password-reset email. Owns the `auth` database schema (drizzle migrations applied on startup).
- **Python Fast API** (`/fast-api`) - The application backend: all CRUD, RAG, AI operations, and external service integration (R2, AssemblyAI, YouTube, LLMs)
- **Go migration runner** (`/go-api`) - Applies database schema migrations on startup and serves `/health`. Owns no application logic.
- **Mobile App** (`/mobile`) - Expo React Native app (iOS/Android)

---

## 📖 Before Working on This Project

**IMPORTANT**: This document is the high-level overview. Before making changes to specific services, read through their respective documentation.

- **Working on backend code (CRUD/RAG/AI)?** → Read [`/fast-api/AGENTS.md`](./fast-api/AGENTS.md)
- **Working on frontend code?** → Read [`/frontend/AGENTS.md`](./frontend/AGENTS.md)
- **Working on database migrations?** → Read [`/go-api/AGENTS.md`](./go-api/AGENTS.md)
- **Working on mobile app?** → Read [`/mobile/AGENTS.md`](./mobile/AGENTS.md)

---

## Architecture Overview

- Frontend (Vite SPA) is served statically; nginx routes `/rag-api/*` (FastAPI) and `/api/auth/*` (auth-server), with rate limiting and security headers.
- All application traffic (CRUD + RAG/external) flows to FastAPI → PostgreSQL / pgvector / external providers.
- Better-Auth runs in the dedicated auth-server; FastAPI validates JWTs via its JWKS endpoint.
- `go-api` is not in the request path. It runs once on deploy to apply pending schema migrations, then idles serving `/health`.

---

## Service Responsibilities

### Python FastAPI (`/fast-api` - Port 8081) — the application backend

Owns everything the app does: CRUD, auth/ownership checks, business logic, all DB writes, external integrations (R2, AssemblyAI, YouTube, LLMs), RAG queries with streaming, hybrid vector + FTS search, embeddings, and Jetflow agent orchestration. Validates Better-Auth JWTs via JWKS.

**Access Pattern:** Frontend → nginx (`/rag-api/*`) → FastAPI (port 8081); the Vite dev proxy fills nginx's role locally. Streams Server-Sent Events (SSE) for real-time updates.

### Go migration runner (`/go-api` - Port 8080)

**Owns only:**
- ✅ **App schema migrations** - `migrations/*.sql` are the source of truth for the `public` (application) database schema (golang-migrate)
- ✅ **`schema.sql`** - dumped snapshot of the migrated schema (reference + CI)
- ✅ **`/health`** - minimal chi endpoint for the container healthcheck

It does **not** own the `auth` schema — that belongs to `/auth-server` (see
below). App tables FK into `auth."user"`, so on a fresh database auth-server
must migrate first; the compose files enforce this (`go-api depends_on
auth-server`).

It is not in the request path and owns no application logic. On startup it
applies pending migrations (`AUTO_MIGRATE=true`), then idles serving `/health`.
See [`/go-api/AGENTS.md`](./go-api/AGENTS.md) for migration rules.

### Authentication Flow (High Level)

- Better-Auth runs in the dedicated auth-server (`/auth-server`, port 8082) and issues sessions + JWTs.
- Web auth traffic stays same-origin: `/api/auth/*` is routed to the auth-server (Vite dev proxy locally, nginx in prod).
- FastAPI validates JWTs via the auth-server's JWKS endpoint (`{BETTER_AUTH_URL}/api/auth/jwks`). (`go-api` does not handle auth.)
- The mobile app hits nginx directly using a Better-Auth cookie.

---

## Data Flow & Type Safety

### Source of Truth: FastAPI

All application data flows through the FastAPI backend.

**Schema & Types:**
- Schema migrations live in `go-api/migrations/*.sql` (golang-migrate) and define the database schema.
- FastAPI's OpenAPI spec (`fast-api/openapi.json`) defines the API contracts.
- Frontend and mobile generate TypeScript types from the FastAPI OpenAPI spec via orval — run the respective `generate:api` script in both after API changes.

**Data Access:**
```
Frontend → FastAPI → PostgreSQL
          ↓
    (snake_case types)
```

**Benefits:**
- Single source of truth for the API (FastAPI)
- Type safety across stack (FastAPI OpenAPI → orval → TypeScript)
- No manual type mapping needed
- API changes automatically propagate to frontend and mobile

For implementation details, see:
- Backend / API type generation: [`/fast-api/AGENTS.md`](./fast-api/AGENTS.md)
- Schema migrations: [`/go-api/AGENTS.md`](./go-api/AGENTS.md)
- Frontend type usage: [`/frontend/AGENTS.md`](./frontend/AGENTS.md)
- Mobile type usage: [`/mobile/AGENTS.md`](./mobile/AGENTS.md)

---

## Environments & Deployment

- Two live environments: `dev` and `prod`.
- Deployments run on Dokploy using `docker-compose.yml`.
- Deployed ingress uses Nginx for routing, rate limiting, and easier debugging.
- If you add or rename any env vars, update `docker-compose.yml` (and `docker-compose.local.yml`) so the deployment stays in sync.
- Service-specific setup details live in their respective AGENTS.md files.
- After schema updates, run `make dump-schema` to refresh `go-api/schema.sql`. To inspect the current database schema, check `go-api/schema.sql`.
- Local dev typically uses Doppler for env injection:
  - `doppler run -- pnpm dev` (frontend)
  - `doppler run -- uv run uvicorn app.main:app --reload --port 8081` (fast-api)
  - `doppler run -- make migrate-up` from `go-api` (apply schema migrations against the local DB)

## Verifying Changes (no Doppler needed)

- `.claude/skills/verify-root/` runs the whole stack locally: local Postgres, moto for R2, and a fake Voyage/Gemini. It drives the SPA with Playwright and saves screenshots, video and DB evidence to `.verify/evidence/`. Start with `scripts/up.sh`, then `harness/run.mjs <scenario>`, then `scripts/down.sh`.
- `scripts/compare.sh <base-ref> <scenario>` records the same scenario against a base ref and against the current checkout, side by side.
- Keep its feature map honest with `/maintain-verification-skill`.

## MCP Servers for Triage

- **Neon** (`mcp__neon__*`) — prod Postgres, project `root`, default branch = prod. Read-only. Use for data integrity, embedding coverage, schema lookups, and slow queries.
- **Logfire** (`mcp__logfire__*`) — traces/spans/logs and exception issues for FastAPI. Use for error and latency triage.

Default order for prod issues: Logfire (find failure) → Neon (verify data) → code.

---
