# Shared config for verify-root scripts. Sourced, not executed.
# All ports derive from VERIFY_PORT_OFFSET (steps of 10) so instances (e.g. main
# vs branch worktrees) can run side by side without colliding.

set -euo pipefail

SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_ROOT="$(cd "$SKILL_DIR/../../.." && pwd)"
# App source to run. Defaults to this checkout; compare.sh points it at a
# worktree of another ref. State/evidence always live under REPO_ROOT/.verify.
APP_ROOT="${VERIFY_APP_ROOT:-$REPO_ROOT}"

OFFSET="${VERIFY_PORT_OFFSET:-0}"
INSTANCE="i${OFFSET}"

PG_PORT=$((55432 + OFFSET * 10))
API_PORT=$((18081 + OFFSET * 10))
AUTH_PORT=$((18082 + OFFSET * 10))
FAKE_PORT=$((18090 + OFFSET * 10))
S3_PORT=$((19000 + OFFSET * 10))
WEB_PORT=$((13000 + OFFSET * 10))

# Instance state lives under the checkout; evidence lives beside it and is never
# touched by down.sh. Both are gitignored (.verify/).
VERIFY_HOME="$REPO_ROOT/.verify"
RUN_DIR="$VERIFY_HOME/run/$INSTANCE"
EVIDENCE_ROOT="$VERIFY_HOME/evidence"

PG_CONTAINER="root-verify-pg-$INSTANCE"
PG_IMAGE="paradedb/paradedb:0.20.5"      # same image as CI integration tests
MIGRATE_IMAGE="migrate/migrate:v4.19.0"  # same as CI

# Local-only DB. Scripts refuse to run against anything else.
DATABASE_URL="postgres://postgres:postgres@127.0.0.1:${PG_PORT}/root?sslmode=disable"
WEB_URL="http://localhost:${WEB_PORT}"

VERIFY_EMAIL="verify@example.com"
VERIFY_PASSWORD="verify-password-123"
VERIFY_NAME="Verify Bot"

log() { printf '[verify-root:%s] %s\n' "$INSTANCE" "$*" >&2; }
die() { log "ERROR: $*"; exit 1; }

assert_local_db() {
  case "$1" in
    *@127.0.0.1:*|*@localhost:*) ;;
    *) die "refusing: DATABASE_URL is not local ($1)";;
  esac
}

# Minimal, explicit environment for every service we launch: nothing from the
# caller's shell or Doppler (DATABASE_URL, LOGFIRE_TOKEN, real API keys) leaks in.
base_env() {
  local v
  echo "PATH=$PATH" "HOME=$HOME"
  for v in HTTPS_PROXY HTTP_PROXY NO_PROXY https_proxy http_proxy no_proxy \
           SSL_CERT_FILE REQUESTS_CA_BUNDLE NODE_EXTRA_CA_CERTS \
           PLAYWRIGHT_BROWSERS_PATH UV_CACHE_DIR; do
    [ -n "${!v:-}" ] && echo "$v=${!v}"
  done
  return 0
}

pid_alive() { [ -f "$RUN_DIR/$1.pid" ] && kill -0 "$(cat "$RUN_DIR/$1.pid")" 2>/dev/null; }

wait_http() {  # wait_http <name> <url> <timeout_s>
  local i
  for ((i = 0; i < $3; i++)); do
    curl -fsS -o /dev/null --max-time 2 "$2" 2>/dev/null && return 0
    sleep 1
  done
  die "$1 not ready at $2 after $3s (log: $RUN_DIR/$1.log)"
}
