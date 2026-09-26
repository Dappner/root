#!/usr/bin/env bash
# Tear down only what up.sh started for this instance: its process groups (by
# recorded pid, never by name) and its postgres container. Evidence under
# .verify/evidence/ is never touched.

source "$(dirname "$0")/common.sh"
set +e

for pidfile in "$RUN_DIR"/*.pid; do
  [ -f "$pidfile" ] || continue
  pid=$(cat "$pidfile")
  if kill -0 "$pid" 2>/dev/null; then
    kill -TERM -- "-$pid" 2>/dev/null || kill -TERM "$pid"
    for _ in 1 2 3 4 5; do kill -0 "$pid" 2>/dev/null || break; sleep 1; done
    kill -KILL -- "-$pid" 2>/dev/null
  fi
  log "stopped $(basename "$pidfile" .pid) (pgid $pid)"
done
if docker ps -a --format '{{.Names}}' 2>/dev/null | grep -qx "$PG_CONTAINER"; then
  docker rm -f "$PG_CONTAINER" >/dev/null && log "removed $PG_CONTAINER"
fi
rm -rf "$RUN_DIR"
log "down. evidence kept in $EVIDENCE_ROOT"
