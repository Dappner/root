# Fast API (Python) - Developer Guide

## Overview

FastAPI is the application backend. It owns CRUD, authentication and authorization checks, business logic, RAG/search, AI workflows, and external integrations.

The old Go backend has been retired from application traffic. The remaining Go service is only the schema migration runner; it applies migrations and serves `/health`.

## Responsibilities

- CRUD operations for sources, sections, citations, captures, takeaways, notes, tags, collections, videos, podcasts, playback, and admin surfaces.
- Authentication and authorization via Better-Auth JWT validation through JWKS.
- Business logic, validation, ownership checks, and database writes.
- RAG search and streaming responses.
- External integrations (R2 storage, YouTube/AssemblyAI transcripts).
- Embeddings and LLM calls (Voyage, OpenAI, Gemini).
- Agent orchestration for multi-step retrieval.

## Workflow
- After adding endpoints, refresh the OpenAPI spec.
- Also refresh the API generations for mobile and frontend, and run type checks there to ensure nothing is broken before moving forward (if editing or changing the API of an existing endpoint).
- After finishing work, ensure type checks work (make typecheck)

## High-Level Flow

- Frontend calls `/rag-api/*` (proxied via Next.js) to FastAPI.
- Mobile calls the same FastAPI surface through nginx.
- FastAPI validates JWT via JWKS from the dedicated auth-server.
- CRUD routes read/write PostgreSQL through SQLAlchemy repositories/services.
- RAG pipelines query pgvector, optionally call LLMs, and stream results back.

## Separation of Concerns

- **Routes**: request/response parsing, auth, and orchestration. Never call `db.commit()` — the `get_db` dependency commits on success and rolls back on exception.
- **Services**: core business logic (RAG pipeline, external providers, embeddings). See **Transaction ownership** below for who commits when.
- **Repositories**: data access only — `db.add` / `db.flush` / queries. Repos never call `db.commit()`.
- **Models/DB**: SQLAlchemy models and vector search helpers.
- **Providers** (`app/providers/`): the seams services depend on. Each has a Protocol, a deterministic in-repo fake, and a factory that picks the real integration or the fake from settings (e.g. `Embedder`, `EMBEDDING_PROVIDER=voyage|fake`). Services type-hint against the Protocol, never a vendor SDK.
  - LLMs: services call `create_llm_client(ModelConfig)` from `app/providers/llm.py` and get a Jetflow `AsyncBaseClient` (Jetflow's client interface is already vendor-neutral). `LLM_PROVIDER=live` builds vendor clients (`app/integrations/llm.py`, which also checks API keys); `LLM_PROVIDER=fake` gives `FakeLLMClient`, which follows Jetflow's protocol with scripted responders keyed by action/schema name (`DEFAULT_RESPONDERS`). Tests swap providers with `set_llm_provider()`.
  - Object storage: services take an `ObjectStore` (`app/providers/object_store.py`); `OBJECT_STORE_PROVIDER=r2` is `R2Client` (any S3 endpoint), `memory` is `InMemoryObjectStore`. The backend reads its own objects with `get_json`/`get_bytes` (async: `read_json`), never by fetching `get_public_url` over HTTP; public/presigned URLs are only for browsers and third parties (e.g. AssemblyAI). Store errors are `ObjectStoreError`/`ObjectNotFoundError`, not boto's.
- **Integrations**: provider-specific clients (R2, YouTube/AssemblyAI, LLMs) and the real implementations of provider Protocols (e.g. `VoyageEmbedder`).

## Dependency Injection

Use FastAPI dependencies for request-scoped boundaries and cross-cutting wiring:

- `get_db`: request transaction boundary. It commits on success and rolls back on exception.
- `get_current_user_id` / `require_admin_user`: auth and authorization entry points.
- External clients and cache providers (`R2Client`, `Embedder`, cache): injectable so tests can replace them.
- Service factories when the service needs injected clients, a session factory, or an expensive shared dependency.

**Wiring rule (services into routes):** routes obtain services through a factory
in `app/deps.py` injected via `Depends`, e.g.
`service: Annotated[FooService, Depends(foo_service)]`. Do **not** import a
module-level service singleton into a route. The factory pattern keeps wiring in
one place and gives tests a `dependency_overrides` seam. Two exceptions:

- A service that needs the request-scoped `db` (or another per-request value) at
  construction is built in the handler — e.g. `RAGService(db, embedder)` in
  `app/api/rag.py`.
- A service consumed by both routes and non-route callers (which can't use
  `Depends`) keeps a module accessor for the non-route path; the `deps.py`
  factory delegates to it so routes still inject consistently — e.g.
  `audio_transcription_service()` → `get_audio_transcription_service()`.

Keep dependency aliases and service factories pragmatic. If an endpoint is clearer with:

```python
user_id: Annotated[str, Depends(get_current_user_id)]
db: Annotated[AsyncSession, Depends(get_db)]
```

use that directly. Type aliases like `CurrentUserId` or `DbSession` are acceptable only if they reduce repetition across a module without hiding too much from readers.

Do not push business rules into dependencies just to make handlers shorter. Domain behavior belongs in services. Dependencies should mostly provide auth context, database/session boundaries, clients, caches, and service instances.

**Routes that take `BackgroundTasks` use `Depends(get_db, scope="function")`.** FastAPI runs background tasks *before* tearing down request-scoped dependencies, so with plain `Depends(get_db)` the request commits only after the background work ran, and a task that re-reads what the request wrote (embedding a new citation) sees nothing. `tests/test_background_task_db_scope.py` enforces this.

For background jobs and resumable streams, be explicit about lifecycle. If the work must outlive the HTTP request, inject or pass a `session_factory` and let that service own its transaction instead of relying on request-scoped `get_db`.

## Transaction ownership

One rule decides who may call `db.commit()`:

- **A service method that takes `db: AsyncSession` as a parameter MUST NOT commit.** The caller owns the transaction boundary. For HTTP requests that caller is the `get_db` dependency, which autocommits on success and rolls back on exception. Use `await db.flush()` if you need DB-assigned values (server defaults, etc.) populated before the method returns.
- **A service method that opens its own session via `session_factory` MUST commit explicitly.** It is its own unit of work — background tasks, fire-and-forget embedding refresh, transcript pipelines all fall into this bucket.
- **Repositories never commit, ever.**

Why: composes cleanly. A route handler can call N takes-db services and they all land in one transaction. A background service is request-independent and manages its own lifecycle. The split between the two is mechanical (who got the session?) so there's no judgment call per method.

## Folder Structure (app/)

- `app/api/`: FastAPI route handlers (CRUD, RAG, admin, media, transcript, health).
- `app/services/`: core business logic and orchestration (CRUD workflows, RAG, embeddings, transcripts, review).
- `app/services/agent/`: agent orchestration and actions.
- `app/schemas/`: request/response schemas for APIs.
- `app/models/`: SQLAlchemy models and DB session helpers.
- `app/repositories/`: data access helpers and query construction.
- `app/core/`: config, auth, logging, cache, DB utilities.
- `app/providers/`: provider Protocols, fakes, and factories (the seams).
- `app/integrations/`: provider-specific external clients and real provider implementations.
- `app/prompts/`: prompt templates and prompt helpers.

## Datetime / Timezone Convention

All timestamps in the DB are stored as UTC. Most columns are `timestamp without time zone` (naive); some migrated tables (`notes`, `review_items`, `review_suggestions`, `reviews`, `suggestions`) use `timestamp with time zone`. Treat both shapes as UTC instants regardless of the Postgres type.

**Rules (Python side):**

- Never call `datetime.now(timezone.utc)`, `datetime.utcnow()`, or `datetime.now()` directly in service/repository/route code. Use `from app.core.datetime_utils import utcnow`.
- `utcnow()` returns a **naive** UTC datetime. This is the canonical write shape — it works for both naive and `timestamptz` columns (asyncpg accepts naive datetimes against `timestamptz` as UTC, and matches naive columns exactly).
- For inputs from external sources that may be tz-aware (RFC-2822 parsed dates, third-party APIs, frontend ISO strings), normalize at the repository boundary with `to_naive_utc(value)`.
- For comparisons against values read from `timestamptz` columns (asyncpg returns aware), normalize both sides with `to_aware_utc(value)`.
- For response schemas, type datetime fields as `UTCDatetime` (from `app.core.datetime_utils`) instead of bare `datetime`. This emits ISO-8601 with an explicit `Z` suffix so JS `new Date(...)` parses it as UTC.

**Why:** asyncpg refuses to bind a tz-aware datetime to a `timestamp without time zone` column ("can't subtract offset-naive and offset-aware datetimes"). Standardizing on naive-UTC writes via `utcnow()` removes the foot-gun across both column shapes.

## Auth Contract

- JWTs come from Better-Auth in the dedicated auth-server (`/auth-server`).
- FastAPI validates via JWKS; no shared secrets.

## External Services

- **R2**: object storage for uploads and processed assets.
- **YouTube/AssemblyAI**: transcript generation.
- **LLMs/Embeddings**: OpenAI, Gemini, Voyage.

## Observability

- Logs and traces are sent to Logfire.

## Linting & Checks

- Run all checks under Doppler so config (`settings`) loads: `doppler run -- make <target>`.
  - `doppler run -- make lint` (ruff)
  - `doppler run -- make format` (ruff + black)
  - `doppler run -- make typecheck` (mypy)
  - `doppler run -- make test-unit` (pytest, no DB)
  - `doppler run -- make test-integration` (pytest, needs a migrated `TEST_DATABASE_URL`)
- Unit tests still import `app.core.config` at collection time, so they need
  `DATABASE_URL` set even though they never touch the DB. `tests/conftest.py`
  defaults `EMBEDDING_PROVIDER=fake`, `LLM_PROVIDER=fake` and `OBJECT_STORE_PROVIDER=memory`, so no provider keys are needed:
  `DATABASE_URL=postgresql://test:test@localhost:5432/test make test-unit`

## References

- High-level architecture: [`/AGENTS.md`](../AGENTS.md)
- Frontend proxy routes: [`/frontend/AGENTS.md`](../frontend/AGENTS.md)
- Mobile app: [`/mobile/AGENTS.md`](../mobile/AGENTS.md) — also consumes FastAPI endpoints (RAG, playback progress)
