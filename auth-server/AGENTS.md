# Auth Server Agent Guide

Dedicated Better-Auth service (Hono on Bun). Issues sessions + JWTs, exposes
JWKS (FastAPI validates against it), handles admin user management and
password-reset email. Reached as `/api/auth/*` via nginx.

## Owns the `auth` schema

auth-server is the **source of truth for the `auth` database schema**. It applies
its own drizzle migrations on startup (`src/db/migrate.ts`, called before the
Hono server serves traffic). go-api owns only the `public` (application) schema.

Because application tables FK into `auth."user"`, on a **fresh** database
auth-server must migrate **before** go-api. The compose files enforce this:
`go-api depends_on auth-server` (healthy).

## Schema migration workflow (drizzle-kit)

The schema lives in `src/db/schema.ts`. Migrations live in `drizzle/` and are
tracked in the `drizzle.__drizzle_migrations` ledger.

```bash
# 1. Edit src/db/schema.ts (e.g. add a Better-Auth plugin's table).
# 2. Generate a migration from the schema diff:
bun run db:generate            # -> drizzle/NNNN_<name>.sql
# 3. Apply pending migrations (also runs automatically on startup):
bun run db:migrate
# Pull the live DB schema back into schema.ts (introspection):
bun run db:pull
```

- `drizzle-kit` is a devDependency — generation happens in dev. Only the
  generated SQL files + the `drizzle-orm` migrator ship in the image (the
  Dockerfile `COPY drizzle ./drizzle`s them; `.dockerignore` must NOT exclude
  `drizzle`).
- The baseline migration (`0000_baseline_auth_schema.sql`) is hand-made
  idempotent (`IF NOT EXISTS` / guarded enum+FK) so it is a no-op against
  existing dev/prod databases that already have the tables. Generated migrations
  after it run exactly once and need not be idempotent.
- After a schema change, refresh `go-api/schema.sql` (`make dump-schema` from a
  DB where both auth-server and go-api have migrated) so the full-DB snapshot CI
  validates against stays current.

## Adding a Better-Auth plugin

1. `bun add` the plugin, add it to the `plugins` array in `src/auth.ts`.
2. Add the plugin's table(s) to `src/db/schema.ts` and the drizzle adapter's
   `schema` map in `src/auth.ts`.
3. `bun run db:generate` to produce the migration, then commit the SQL.
4. Add the matching client plugin to the consumers' auth clients
   (`frontend/src/lib/auth/client.ts`, `mobile/lib/auth-client.ts`).

Do **not** use the Better-Auth CLI (`auth migrate` / `auth generate`) — its
`migrate` only supports the Kysely adapter (we use drizzle), and `generate`
would compete with the drizzle-kit pipeline. Use `db:generate`.

## Config

Reads: `DATABASE_URL`, `BETTER_AUTH_SECRET` (required — refuses to start
without it), `BETTER_AUTH_URL` (public origin; used for cookie Secure flags +
reset URLs), `ENABLE_SIGNUP`, `TURNSTILE_SECRET_KEY` (captcha, prod only),
`RESEND_API_KEY` + `EMAIL_FROM` (password-reset email), `APP_ENV`, `PORT`
(default 8082). If you add an env var, update `docker-compose.yml` and
`docker-compose.local.yml`.
