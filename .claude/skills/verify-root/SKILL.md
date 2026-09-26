---
name: verify-root
description: Launch the Root web app (Vite SPA + auth-server + FastAPI + local Postgres) fully locally with stubbed AI/R2, drive it in a real browser with Playwright as a logged-in user, and capture proof (screenshots, video, DB rows, provider call logs). Use to prove a UI/API change works, to record before/after evidence for a PR, or whenever you need to see the app running. No Doppler, Neon, real R2 or AI keys needed.
---

# verify-root

Drives the Root web app the way a user does and writes evidence to disk. Everything runs in this checkout. The container gets a local Postgres; fast-api, auth-server and Vite run on the host. External providers are replaced at their HTTP boundary:

| Real | Stand-in | How |
|---|---|---|
| Neon Postgres | `paradedb/paradedb:0.20.5` container (same image as CI) | fresh DB per `up.sh`, removed by `down.sh` |
| Cloudflare R2 | moto S3 server, bucket `root-verify` | `R2_ENDPOINT_URL` |
| Voyage embed/rerank | `scripts/fake_providers.py` (hashed bag-of-words vectors, 1024-d) | `EMBEDDING_BASE_URL` |
| Gemini (default Ask model) | same fake, returns `[stub-llm] ...` text | `GOOGLE_GEMINI_BASE_URL` |
| OpenAI, Anthropic, AssemblyAI, YouTube, ElevenLabs, Resend, Turnstile | **not stubbed** (keys blank) | features using them are unreachable |

**Safety.** Services start with `env -i` plus an explicit variable list, so nothing leaks in from your shell or Doppler (`DATABASE_URL`, `LOGFIRE_TOKEN`, real keys). The scripts refuse any `DATABASE_URL` that isn't `127.0.0.1` or `localhost`.

Paths below are relative to the repo root. `S=.claude/skills/verify-root`.

## Launch

```bash
$S/scripts/up.sh          # ~25s warm; first run also installs deps and pulls images
```

- **Ready when:** it prints the state file path (`.verify/run/i0/state.env`) and `up: http://localhost:13000`.
- **Order:** postgres → auth migrations (`bun run db:migrate`) → app migrations (golang-migrate docker image, like CI) → fakes → auth-server → fast-api → Vite → seed user.
- **Seeded user:** `verify@example.com` / `verify-password-123`, with role `admin`. It is created through the real `/api/auth/sign-up/email` endpoint.
- **Ports for instance `i0`:**

  | Service | Port |
  |---|---|
  | web (Vite, same-origin proxy like nginx) | 13000 |
  | fast-api | 18081 |
  | auth-server | 18082 |
  | fakes | 18090 |
  | S3 | 19000 |
  | Postgres | 55432 |

- **More instances:** `VERIFY_PORT_OFFSET=N` adds `N*10` to every port, giving instance `iN`.
- **Other source tree:** `VERIFY_APP_ROOT=<path>` runs the app from another checkout (a worktree); `compare.sh` uses this.
- **Docker:** in a cloud container `up.sh` starts `dockerd` itself when no daemon is running (root only).
- **Rerunning:** if the instance is already healthy, `up.sh` exits 0. If it is stale, `up.sh` tells you to run `down.sh` first.
- **Code changes:** fast-api runs without `--reload`. After changing backend code, run `down.sh` then `up.sh`. Vite picks up frontend changes live.

## Doctor

```bash
$S/scripts/doctor.sh      # read-only; exit 0 = worth driving
```

It checks:
- the database is local and the schema is migrated (not dirty)
- every recorded pid is alive
- each service answers on its own health endpoint
- `/rag-api` works through the web proxy
- the seeded user can sign in

It also prints the git sha the instance was started from. When that sha differs from the current checkout, the instance is running stale code. Run doctor before the first drive and after any failed or surprising drive.

## Drive

Playwright (Chromium) from `$S/harness`. The harness finds the global `playwright` package, which is preinstalled in cloud containers. Elsewhere, install it once with `npm install --prefix $S/harness playwright-core`.

```bash
cd $S/harness
node run.mjs library-add-source          # one feature scenario → evidence dir (JSON on stdout)
node run.mjs quote-embed-ask --no-video
EXPLORE_ROUTES="/,/library,/ask" node run.mjs _explore --no-video   # screenshots + ARIA snapshot (aria.yml) for finding selectors
VERIFY_PORT_OFFSET=1 node run.mjs <scenario>                         # drive another instance
```

- **Scenarios** live in `harness/scenarios/<name>.mjs`. Each one exports `default async ({ page, shot, sql, state, expect }) => result`:
  - `page` is already logged in, with `baseURL` set.
  - `shot(name)` waits for network idle, then takes a full-page screenshot.
  - `sql(q)` returns `psql -tA` output from the instance's DB.
  - `expect(cond, msg)` throws on failure.
- **One-off checks:** write an ad-hoc scenario anywhere and pass its path: `node run.mjs /tmp/x.mjs`.
- **Selectors:** use roles and accessible names first (`getByRole("button", { name: "Add Source" })`, `getByRole("dialog", { name: "Add Citation" })`, `getByRole("textbox", { name: "Title *" })`). Use `input#email` / `input#password` on `/login`. Don't rely on coordinates or nth-child. When a name is unknown, run `_explore` and read `aria.yml`.
- **Helpers for evidence outside the browser:**
  - `$S/scripts/db.sh "<sql>"` runs psql against the instance.
  - `.verify/run/i0/fake-providers.jsonl` logs one line per stubbed Voyage/Gemini call.
  - `.verify/run/i0/*.log` holds each service's logs.
- **API calls without the UI:** sign in with `POST /api/auth/sign-in/email` (cookie jar, `Origin: http://localhost:13000`). Then `GET /api/auth/token` returns a JWT; send it as `Authorization: Bearer <jwt>` to `/rag-api/*` on port 13000.

Feature-by-feature recipes are in [features/README.md](features/README.md).

## Evidence

Each run writes to `.verify/evidence/<UTC-timestamp>-<scenario>/`:
- numbered `NN-<step>.png` screenshots
- `video.webm` of the whole session
- `events.json`: every `/rag-api` and `/api/auth` response status, plus console errors and page errors
- `result.json`: `ok`, `git_head`, and whatever the scenario returned (ids, urls), or the error plus a `failure.png`

`.verify/` is gitignored and `down.sh` never deletes evidence.

**Before/after for a PR:**

```bash
$S/scripts/compare.sh origin/main <scenario>     # ~1 min; prints the compare dir
```

- The base ref runs from a temporary worktree as instance `i1`. Head is this checkout as `i0`.
- It writes `compare.html`: both videos, both results, and screenshot pairs side by side.
- The base instance and worktree are removed afterwards unless you pass `--keep`.
- Base refs from before `EMBEDDING_BASE_URL` existed (before this skill landed) can't stub Voyage. Compare on UI-only scenarios there.

**Proof standards:**
- Drive the real user path (dialogs, buttons, routes), not internal setters or seeded shortcuts. Seeding is for preconditions only.
- Capture the action and the resulting state (a before shot, the filled form, the after state), not just the final screen.
- Check side effects next to what's visible: DB rows via `sql()`, provider calls in `fake-providers.jsonl`, objects in S3 (`curl http://127.0.0.1:19000/root-verify`).
- Stubs replace only the external provider boundary. Everything from the SDK call inward is real app code. A `[stub-llm]` answer proves the pipeline end to end. It says nothing about answer quality.

## Cleanup

```bash
$S/scripts/down.sh                       # instance i0
VERIFY_PORT_OFFSET=1 $S/scripts/down.sh  # instance i1
```

- `down.sh` kills only the process groups recorded in `.verify/run/iN/*.pid`, never by process name.
- It removes that instance's Postgres container and its run dir.
- Evidence in `.verify/evidence/` stays.
- Run it after every failed `up.sh` too, so broken attempts don't strand ports.

## Helpers

All of these are executable and live in `$S/scripts` unless noted.

| Helper | Invocation |
|---|---|
| launch | `up.sh` |
| health | `doctor.sh` |
| teardown | `down.sh` |
| SQL | `db.sh "<sql>"` |
| before/after | `compare.sh <base-ref> <scenario> [--keep]` |
| fakes (started by `up.sh`) | `fake_providers.py <port>` |
| drive | `harness/run.mjs <scenario> [--no-video]` |

## Gotchas

- **Ask/agents:** `tiktoken` tries to download its encoding from `openaipublic.blob.core.windows.net`, which the cloud proxy blocks. Ask still completes. Ignore the proxy warning.
- **Stub limits:** the fake Gemini never calls tools. Agent flows that need a tool call to progress (e.g. structured outputs) won't. Non-Gemini models in the Ask model picker hit real providers with blank keys and fail.
- **State accumulates on `i0`:** every scenario creates its own uniquely named data, but lists grow. For a clean slate, run `down.sh && up.sh`. In `compare.sh` the base is always fresh while head may not be.
- **Not portable yet:** `setsid` and `/proc` make the scripts Linux-first. They target the cloud container. On macOS, use `docker-compose.local.yml` for now.
