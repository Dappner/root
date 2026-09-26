#!/usr/bin/env bash
# Run SQL against this instance's local database (read side-effects as evidence).
# Usage: db.sh "select id, title from sources order by created_at desc limit 5"
source "$(dirname "$0")/common.sh"
[ -f "$RUN_DIR/state.env" ] || die "instance not up"
docker exec -i "$PG_CONTAINER" psql -U postgres -d root -P pager=off -c "$1"
