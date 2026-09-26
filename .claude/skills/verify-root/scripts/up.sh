#!/usr/bin/env bash
# Launch an isolated Root stack for verification. Local Postgres (docker),
# local S3 (moto) for R2, fake Voyage/Gemini, auth-server, fast-api, Vite.
# No Doppler, no Neon, no real R2, no real AI keys.
#
# Usage: up.sh            (instance 0: web on http://localhost:13000)
#        VERIFY_PORT_OFFSET=1 up.sh   (second instance, all ports +1)
# Prints the instance's state file path on success.

source "$(dirname "$0")/common.sh"

if [ -f "$RUN_DIR/state.env" ]; then
  if "$SKILL_DIR/scripts/doctor.sh" >/dev/null 2>&1; then
    log "already up and healthy: $WEB_URL"; echo "$RUN_DIR/state.env"; exit 0
  fi
  die "stale instance in $RUN_DIR — run scripts/down.sh first"
fi

assert_local_db "$DATABASE_URL"
mkdir -p "$RUN_DIR" "$EVIDENCE_ROOT"

# --- prerequisites ---------------------------------------------------------
if ! docker info >/dev/null 2>&1; then
  if [ "$(id -u)" = 0 ] && command -v dockerd >/dev/null; then
    log "starting dockerd (cloud container)"
    (setsid dockerd >"$VERIFY_HOME/dockerd.log" 2>&1 &)
    for _ in $(seq 1 30); do docker info >/dev/null 2>&1 && break; sleep 1; done
  fi
  docker info >/dev/null 2>&1 || die "docker daemon not reachable"
fi
for bin in bun uv uvx pnpm python3 curl; do
  command -v "$bin" >/dev/null || die "missing $bin"
done
[ -d "$APP_ROOT/fast-api/.venv" ] || (cd "$APP_ROOT/fast-api" && uv sync --frozen >/dev/null)
[ -d "$APP_ROOT/auth-server/node_modules" ] || (cd "$APP_ROOT/auth-server" && bun install --frozen-lockfile >/dev/null)
[ -d "$APP_ROOT/frontend/node_modules" ] || (cd "$APP_ROOT/frontend" && CYPRESS_INSTALL_BINARY=0 pnpm install --frozen-lockfile >/dev/null)

mapfile -t BASE_ENV < <(base_env)
start_bg() {  # start_bg <name> <dir> <cmd...>; env comes from SVC_ENV
  local name=$1 dir=$2; shift 2
  (cd "$dir" && exec setsid env -i "${BASE_ENV[@]}" "${SVC_ENV[@]}" "$@" \
     >"$RUN_DIR/$name.log" 2>&1 </dev/null) &
  echo $! >"$RUN_DIR/$name.pid"
}

# --- postgres --------------------------------------------------------------
log "postgres ($PG_IMAGE) on 127.0.0.1:$PG_PORT"
docker run -d --name "$PG_CONTAINER" --label root-verify="$INSTANCE" \
  -p "127.0.0.1:$PG_PORT:5432" \
  -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=root \
  "$PG_IMAGE" >/dev/null
for _ in $(seq 1 60); do
  docker exec "$PG_CONTAINER" pg_isready -U postgres -d root >/dev/null 2>&1 && break; sleep 1
done
sleep 2  # the image restarts postgres once after init scripts
for _ in $(seq 1 30); do
  docker exec "$PG_CONTAINER" psql -U postgres -d root -c 'select 1' >/dev/null 2>&1 && break; sleep 1
done

# --- migrations: auth schema first (app tables FK into auth.user) -----------
log "auth migrations"
(cd "$APP_ROOT/auth-server" && env -i "${BASE_ENV[@]}" DATABASE_URL="$DATABASE_URL" \
  bun run db:migrate >"$RUN_DIR/migrate-auth.log" 2>&1) || die "auth migrations failed ($RUN_DIR/migrate-auth.log)"
log "app migrations (golang-migrate)"
docker run --rm --network host -v "$APP_ROOT/go-api/migrations:/migrations:ro" "$MIGRATE_IMAGE" \
  -path=/migrations -database "$DATABASE_URL" up >"$RUN_DIR/migrate-app.log" 2>&1 \
  || die "app migrations failed ($RUN_DIR/migrate-app.log)"

# --- fakes -----------------------------------------------------------------
log "fake providers (voyage + gemini) on :$FAKE_PORT"
SVC_ENV=(FAKE_PROVIDERS_LOG="$RUN_DIR/fake-providers.jsonl")
start_bg fake-providers "$SKILL_DIR/scripts" python3 fake_providers.py "$FAKE_PORT"
log "moto S3 (R2 stand-in) on :$S3_PORT"
SVC_ENV=()
start_bg s3 "$RUN_DIR" uvx --from "moto[server]" moto_server -H 127.0.0.1 -p "$S3_PORT"
wait_http fake-providers "http://127.0.0.1:$FAKE_PORT/health" 20
wait_http s3 "http://127.0.0.1:$S3_PORT/" 120
curl -fsS -X PUT "http://127.0.0.1:$S3_PORT/root-verify" >/dev/null

# --- auth-server -----------------------------------------------------------
log "auth-server on :$AUTH_PORT"
SVC_ENV=(
  DATABASE_URL="$DATABASE_URL" BETTER_AUTH_URL="$WEB_URL"
  BETTER_AUTH_SECRET=local-verify-better-auth-secret-0123456789
  ENABLE_SIGNUP=true EMAIL_FROM="Root <noreply@localhost>"
  APP_ENV=local NODE_ENV=development PORT="$AUTH_PORT"
)
start_bg auth-server "$APP_ROOT/auth-server" bun src/index.ts
wait_http auth-server "http://127.0.0.1:$AUTH_PORT/health" 60

# --- fast-api --------------------------------------------------------------
log "fast-api on :$API_PORT"
SVC_ENV=(
  DATABASE_URL="$DATABASE_URL" BETTER_AUTH_URL="$WEB_URL"
  JWKS_URL="http://127.0.0.1:$AUTH_PORT/api/auth/jwks"
  APP_ENV=local LOG_LEVEL=INFO CORS_ORIGINS="[\"$WEB_URL\"]"
  EMBEDDING_API_KEY=fake-voyage-key EMBEDDING_BASE_URL="http://127.0.0.1:$FAKE_PORT/v1"
  GOOGLE_API_KEY=fake-google-key GOOGLE_GEMINI_BASE_URL="http://127.0.0.1:$FAKE_PORT"
  R2_ACCOUNT_ID=verify R2_ACCESS_KEY_ID=verify R2_SECRET_ACCESS_KEY=verify
  R2_BUCKET_NAME=root-verify R2_ENDPOINT_URL="http://127.0.0.1:$S3_PORT"
  NO_PROXY="127.0.0.1,localhost,${NO_PROXY:-}" no_proxy="127.0.0.1,localhost,${no_proxy:-}"
)
start_bg fast-api "$APP_ROOT/fast-api" .venv/bin/uvicorn app.main:app --host 127.0.0.1 --port "$API_PORT"
wait_http fast-api "http://127.0.0.1:$API_PORT/rag-api/health" 90

# --- frontend (Vite dev proxy = same-origin ingress, like nginx in prod) ------
log "frontend (vite) on :$WEB_PORT"
SVC_ENV=(FASTAPI_URL="http://127.0.0.1:$API_PORT" AUTH_URL="http://127.0.0.1:$AUTH_PORT")
start_bg web "$APP_ROOT/frontend" node_modules/.bin/vite --port "$WEB_PORT" --strictPort --host 127.0.0.1
wait_http web "http://127.0.0.1:$WEB_PORT/" 90

# --- seed user (admin) through the real sign-up endpoint ------------------------
log "seeding $VERIFY_EMAIL (admin)"
curl -fsS -o /dev/null -X POST "http://127.0.0.1:$WEB_PORT/api/auth/sign-up/email" \
  -H "Content-Type: application/json" -H "Origin: $WEB_URL" \
  -d "{\"email\":\"$VERIFY_EMAIL\",\"password\":\"$VERIFY_PASSWORD\",\"name\":\"$VERIFY_NAME\"}" \
  || die "seed sign-up failed (see $RUN_DIR/auth-server.log)"
docker exec "$PG_CONTAINER" psql -U postgres -d root -qc \
  "update auth.\"user\" set role='admin' where email='$VERIFY_EMAIL'" >/dev/null

cat >"$RUN_DIR/state.env" <<EOF
INSTANCE=$INSTANCE
RUN_DIR=$RUN_DIR
WEB_URL=$WEB_URL
API_URL=http://127.0.0.1:$API_PORT
AUTH_URL=http://127.0.0.1:$AUTH_PORT
FAKE_URL=http://127.0.0.1:$FAKE_PORT
S3_URL=http://127.0.0.1:$S3_PORT
DATABASE_URL=$DATABASE_URL
PG_CONTAINER=$PG_CONTAINER
VERIFY_EMAIL=$VERIFY_EMAIL
VERIFY_PASSWORD=$VERIFY_PASSWORD
APP_ROOT=$APP_ROOT
GIT_HEAD=$(git -C "$APP_ROOT" rev-parse --short HEAD)$(git -C "$APP_ROOT" diff --quiet HEAD -- . ":!.claude" || echo "+dirty")
STARTED_AT=$(date -u +%Y-%m-%dT%H:%M:%SZ)
EOF
log "up: $WEB_URL (login $VERIFY_EMAIL / $VERIFY_PASSWORD)"
echo "$RUN_DIR/state.env"
