# Go API Agent Guide

`go-api` is no longer a business backend. All CRUD, RAG, auth validation, and
external integrations now live in `/fast-api`. This service has a single job:

> **Apply database schema migrations on startup, then serve `/health`.**

It is a long-running container so deployment platforms can run it as a normal
service (with a healthcheck) rather than a one-shot job, but it owns no
application logic.

## Scope

The Go API owns:

- **Schema migrations** — `migrations/*.sql` are the source of truth for the
  database schema (`golang-migrate`).
- **`schema.sql`** — a dumped snapshot of the migrated schema, used as a
  human/agent reference and by CI to validate the schema fast-api tests run
  against.
- **A minimal HTTP server** — chi router serving only `/health` (used by the
  container/orchestrator healthcheck).

It does **not** own: handlers, services, repositories, DTOs, sqlc, Swagger,
JWT/JWKS validation, embeddings, or any external integration. Do not add those
back here — they belong in `/fast-api`.

## Package Map

```text
go-api/
├── cmd/server/http/   # Binary entry point (loads config, runs migrations, serves /health)
├── internal/app/      # Lifecycle: run migrations -> connect DB -> serve -> graceful shutdown
├── internal/config/   # Minimal config: DATABASE_URL, PORT, APP_ENV, AUTO_MIGRATE
├── internal/database/ # pgx connection pool + golang-migrate runner
├── internal/transport/http/ # Minimal chi router (/health only)
├── migrations/        # SQL migrations (forward-only) — SOURCE OF TRUTH for schema
├── docker/db/         # Local Postgres image (pgvector + pg_search)
└── schema.sql         # Dumped schema snapshot
```

## Configuration

The server reads only:

- `DATABASE_URL` (required)
- `PORT` (default `8080`)
- `APP_ENV` (default `local`; `localhost` uses a text logger, anything else uses JSON)
- `AUTO_MIGRATE` (default `true`; when true, pending migrations run on startup)

If you add a new env var here, update `docker-compose.yml` and
`docker-compose.local.yml` so deployments stay in sync.

## Commands

Run from `go-api/` unless noted.

```bash
make dependencies    # Install the golang-migrate CLI
make db              # Start local Postgres (docker compose)
make migrate-up      # Apply all pending migrations
make migrate-status  # Show current migration version + dirty state
make migrate-to N    # Migrate up/down to a specific version
make migrate-force N # Force the schema_migrations version (dirty-state recovery)
make migration NAME  # Create a new (forward-only) migration file
make dump-schema     # Refresh schema.sql from the running DB
make dev             # db + migrate-up + run the migration runner
make build           # Build the binary
```

`go build ./...` and `go vet ./...` are the only verification gates (there are
no Go unit tests; CI runs build + vet).

## Migration Rules & Gotchas

- **Forward-only.** Do not add down migrations. `make migration` deletes the
  generated `.down.sql` automatically. `migrate-force`/`migrate-to` exist for
  recovery, not routine rollbacks.
- **Refresh `schema.sql`** with `make dump-schema` after any migration so the
  snapshot (and the schema CI tests run against) stays current.
- **Dirty migrations:** if `migrate-status` reports a dirty state, fix the DB
  manually, then `make migrate-force <version>` to the intended version. Do not
  force blindly.
- **Auth schema is NOT owned here.** The `auth` schema (Better-Auth tables) is
  owned by `/auth-server`, which applies its own drizzle migrations on startup.
  go-api only owns the `public` (application) schema. App tables FK into
  `auth."user"`, so on a fresh database **auth-server must migrate before
  go-api** — the compose files enforce this (`go-api depends_on auth-server`).
  Do not re-add an auth-schema migration here. Better-Auth user IDs are `TEXT` —
  never assume integer user IDs in migrations.
- **Standalone migration runs bootstrap auth first.** When go-api migrations run
  WITHOUT auth-server (`make migrate-up`, `make dev`), the `auth` schema won't
  exist yet and `000002`'s FK to `auth."user"` would fail. Those local paths
  first apply auth-server's idempotent baseline
  (`../auth-server/drizzle/0000_baseline_auth_schema.sql`) via the
  `bootstrap-auth` prerequisite. CI runs the auth-server Drizzle migrator before
  applying go-api migrations, so it exercises the same ordering as compose:
  auth migrations first, then app migrations. If you add a NEW first app
  migration or change the FK, keep both bootstrap paths working.
- **Downstream of schema changes**, update:
  - fast-api SQLAlchemy/Pydantic models and any raw SQL reading the changed tables.
  - root data scripts that depend on migrated columns, especially
    `scripts/clone_user_data.py` and `scripts/seed_db.py` (and migration
    repair/seed helpers).
  - Regenerate the fast-api OpenAPI spec and the frontend/mobile orval clients
    if a schema change is API-visible (those types now come solely from
    fast-api — see the root and frontend guides).

Use `schema.sql` or the migration files as the source of truth for table
definitions; do not copy large schema excerpts into this file.
