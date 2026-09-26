#!/usr/bin/env bash
# Read-only health check: "is this instance worth driving?"
# Exit 0 = every check passed. Run before the first drive and after any
# failed or surprising drive.

source "$(dirname "$0")/common.sh"
set +e

fail=0
check() {  # check <label> <cmd...>
  if "${@:2}" >/dev/null 2>&1; then printf '  ok    %s\n' "$1"
  else printf '  FAIL  %s\n' "$1"; fail=1; fi
}

echo "verify-root doctor ($INSTANCE)"
[ -f "$RUN_DIR/state.env" ] || { echo "  FAIL  no state at $RUN_DIR/state.env (run scripts/up.sh)"; exit 1; }
source "$RUN_DIR/state.env"

check "database is local ($DATABASE_URL)" assert_local_db "$DATABASE_URL"
check "postgres container running"        docker exec "$PG_CONTAINER" pg_isready -U postgres -d root
check "app schema migrated (clean, not dirty)" \
  bash -c "docker exec $PG_CONTAINER psql -U postgres -d root -tAc 'select not dirty from schema_migrations' | grep -qx t"
for svc in fake-providers s3 auth-server fast-api web; do
  check "$svc process alive (pid $(cat "$RUN_DIR/$svc.pid" 2>/dev/null))" pid_alive "$svc"
done
check "fake providers /health"   curl -fsS --max-time 3 "$FAKE_URL/health"
check "s3 bucket root-verify"    curl -fsS --max-time 3 "$S3_URL/root-verify"
check "auth-server /health"      curl -fsS --max-time 3 "$AUTH_URL/health"
check "fast-api /rag-api/health" curl -fsS --max-time 3 "$API_URL/rag-api/health"
check "web serves index via vite" bash -c "curl -fsS --max-time 5 '$WEB_URL/' | grep -q '<div id=\"root\"'"
check "fast-api reachable through web proxy" curl -fsS --max-time 3 "$WEB_URL/rag-api/health"
check "seed user can sign in" curl -fsS --max-time 5 -o /dev/null -X POST "$WEB_URL/api/auth/sign-in/email" \
  -H "Content-Type: application/json" -H "Origin: $WEB_URL" \
  -d "{\"email\":\"$VERIFY_EMAIL\",\"password\":\"$VERIFY_PASSWORD\"}"
echo "  build: $GIT_HEAD from $APP_ROOT (now: $(git -C "$APP_ROOT" rev-parse --short HEAD)), started $STARTED_AT"
exit $fail
