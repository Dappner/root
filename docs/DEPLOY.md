# Deployment Guide

Quick guide for deploying Root to Dokploy with Docker.

---

## Architecture

Five services:

1. **PostgreSQL** (with pgvector extension)
2. **Auth Server** (Better-Auth on Hono/Bun) — Port 8082 — sessions, JWTs, JWKS, admin user management, password-reset email. Owns the `auth` schema (drizzle migrations on startup).
3. **Go migration runner** (`go-api`) — Port 8080 — applies `migrations/*.sql` on startup, then serves `/health`. Owns no application logic and is not in the request path.
4. **RAG / App Service** (Python `fast-api`) — Port 8081 — all CRUD, RAG, AI, and external-service operations. Validates JWTs via the auth-server's JWKS.
5. **Frontend** (Vite + TanStack Router SPA) — Port 3000 — static bundle served by nginx, which also proxies the auth and RAG API paths to the backend edge.

> The frontend is a pure client-side SPA (no Node server). nginx serves the
> built `dist/` and forwards the browser's same-origin API calls to the backend
> edge (`API_URL`).

A separate **nginx** service (the backend edge, port 80) reverse-proxies the auth
path to the auth-server and the RAG path to fast-api. The frontend forwards to
this edge via `API_URL`; the two deployments stay independent.

---

## Prerequisites

- Dokploy instance
- PostgreSQL 15+ with pgvector extension
- Voyage AI API key (embeddings)
- OpenAI API key (LLM / review generation)
- Google API key (Gemini LLM + YouTube Data API)
- Optional: AssemblyAI API key + Cloudflare R2 bucket (for podcast transcripts)
  - Create R2 bucket named `{environment}-root` (e.g. `prod-root`, `dev-root`)
  - Enable public access for transcript URLs or configure a custom domain
  - Generate R2 API tokens with read/write permissions

---

## Deployment Order

Deploy in this exact order:

1. **Database** — create PostgreSQL with the pgvector extension
2. **Auth Server** — migrates the `auth` schema (app tables FK into `auth."user"`)
3. **Go migration runner** — applies the application schema migrations
4. **RAG / App Service** — requires the migrated schemas
5. **Backend nginx** — requires auth-server + fast-api
6. **Frontend** — requires the backend edge (`API_URL`) reachable

---

## Environment Variables

Placeholders below use angle brackets — set real values in Dokploy.

### 1. Auth Server

- **Build Context:** `auth-server/`
- **Port:** 8082

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | Postgres connection string (use TLS in prod) |
| `BETTER_AUTH_SECRET` | Yes | Random string, min 32 chars (`openssl rand -base64 32`) |
| `BETTER_AUTH_URL` | Yes | Must EXACTLY match the deployed frontend origin |
| `ENABLE_SIGNUP` | No | `true` to allow account creation, then `false` to disable |
| `TURNSTILE_SECRET_KEY` | Prod | Cloudflare Turnstile server secret (pairs with the frontend site key) |
| `RESEND_API_KEY` | Opt | Resend key for password-reset email |
| `EMAIL_FROM` | Opt | Sender address for auth emails |
| `PORT` | — | `8082` |

Health check: `GET /health`

### 2. Go Migration Runner

- **Build Context:** `go-api/`
- **Port:** 8080

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | Same Postgres connection string |
| `APP_ENV` | Yes | `production` |
| `AUTO_MIGRATE` | No | Run migrations on startup (default: `true`) |
| `PORT` | — | `8080` |

Applies `migrations/*.sql` on startup, then idles serving `/health`. Not in the
request path.

### 3. RAG / App Service (Python)

- **Build Context:** `fast-api/`
- **Port:** 8081

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | Same Postgres connection string |
| `JWKS_URL` | Yes | auth-server JWKS over the internal network |
| `BETTER_AUTH_URL` | Yes | Frontend origin |
| `EMBEDDING_API_KEY` | Yes | Voyage AI key |
| `LLM_API_KEY` | Yes | OpenAI key |
| `GOOGLE_API_KEY` | Yes | Gemini + YouTube Data API |
| `ASSEMBLYAI_API_KEY` | Opt | Podcast transcription |
| `R2_ACCOUNT_ID` / `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` | Opt | Cloudflare R2 credentials |
| `R2_BUCKET_NAME` | Opt | `{env}-root` |
| `R2_ENDPOINT_URL` / `R2_PUBLIC_URL_BASE` | Opt | R2 endpoint + public base |
| `LOG_LEVEL` | Opt | `INFO` |

Health check: `GET /rag-api/health`. Owns all CRUD + RAG + AI + external-service
operations; the browser reaches it via the backend nginx (RAG path). Uses SSE for
streaming; requires pgvector.

### 4. Frontend (Vite + TanStack Router SPA)

- **Build Context:** `frontend/`
- **Port:** 3000 (nginx — there is no Node server)

**Runtime env** (read by nginx at container start):

| Variable | Required | Description |
|---|---|---|
| `API_URL` | Yes | The backend edge this SPA forwards the auth + RAG paths to |

**Build arguments** (Vite inlines `VITE_*` at build time — set in Dokploy's Build section):

| Build arg | Required | Description |
|---|---|---|
| `VITE_TURNSTILE_SITE_KEY` | Prod | Cloudflare Turnstile site key (public) |
| `VITE_ENABLE_SIGNUP` | No | Shows the signup UI link (the auth-server enforces the real gate) |
| `VITE_RELEASE` | No | Build id surfaced to the version-refresh banner (`/version.json`) |
| `VITE_APP_ENV` | No | `local` disables CAPTCHA; otherwise defaults to the build env |

`VITE_*` MUST be build arguments, not runtime env — Vite embeds them into the
static bundle at build time. `API_URL` is the only runtime variable.

Health check: `GET /health`.

Notes:
- `BETTER_AUTH_URL` (auth-server + fast-api) must EXACTLY match where users access the frontend; a mismatch yields an `INVALID_ORIGIN` error.
- Signup is gated by `ENABLE_SIGNUP` on the auth-server; `VITE_ENABLE_SIGNUP` only toggles the UI link.
- Deep links work via the nginx SPA fallback (`try_files … /index.html`); hard reloads on nested routes resolve client-side.

---

## Quick Start

1. **Database** — create PostgreSQL and enable pgvector (`CREATE EXTENSION IF NOT EXISTS vector;`).
2. **Auth Server** — Dokploy service, build context `auth-server/`, add env, deploy, wait for `auth` schema migrations.
3. **Go runner** — build context `go-api/`, add env, deploy, wait for app schema migrations.
4. **RAG / App** — build context `fast-api/`, add env, deploy, verify `GET /rag-api/health`.
5. **Backend nginx** — build context `nginx/`, deploy (depends on auth-server + fast-api).
6. **Frontend** — build context `frontend/`, expose port **3000**, set runtime `API_URL` and the `VITE_*` build args, deploy.
   - Create your account, then set `ENABLE_SIGNUP=false` on the auth-server.
7. Confirm `BETTER_AUTH_URL` on auth-server + fast-api points to the live frontend origin.

---

## Common Issues

- **`INVALID_ORIGIN`** — `BETTER_AUTH_URL` (auth-server + fast-api) must EXACTLY match the browser origin.
- **Frontend loads but API calls 404/502** — `API_URL` on the frontend must point at the reachable backend edge (nginx); the SPA's auth + RAG paths are proxied there.
- **fast-api can't validate JWTs** — `JWKS_URL` must point to the auth-server's JWKS over the internal network.
- **CAPTCHA widget missing** — `VITE_TURNSTILE_SITE_KEY` is a build argument; rebuild after setting it. A runtime env var won't reach the client bundle.
- **Deep-link / hard refresh 404s** — ensure the frontend nginx SPA fallback is active (ships in `frontend/default.conf.template`).
- **Signup still showing after disabling** — set `ENABLE_SIGNUP=false` on the auth-server; `VITE_ENABLE_SIGNUP` only controls the UI link.

---

## Security Checklist

- [ ] Require TLS for production database connections
- [ ] Generate strong secrets (`openssl rand -base64 32`)
- [ ] Use HTTPS for all public origins
- [ ] Set `ENABLE_SIGNUP=false` on the auth-server after account creation
- [ ] Store sensitive values as Dokploy secrets

---

See also:
- [Root AGENTS.md](../AGENTS.md) — architecture overview
- [Auth Server AGENTS.md](../auth-server/AGENTS.md) — auth service
- [Frontend AGENTS.md](../frontend/AGENTS.md) — frontend
- [RAG / App Service AGENTS.md](../fast-api/AGENTS.md) — backend
- [Go migration runner AGENTS.md](../go-api/AGENTS.md) — schema migrations
