#!/usr/bin/env bash
# Before/after proof: run one scenario against <base-ref> and against this
# checkout, side by side, and write a compare.html with both videos + screenshots.
#
# Usage: compare.sh <base-ref> <scenario> [--keep]
#   e.g. compare.sh origin/main library-add-source
# Base runs as instance i1 (ports +10) from a temporary git worktree; head uses
# instance i0 (started if not already up). --keep leaves the base instance and
# worktree running. Prints the compare directory.

source "$(dirname "$0")/common.sh"

BASE_REF="${1:?usage: compare.sh <base-ref> <scenario> [--keep]}"
SCENARIO="${2:?usage: compare.sh <base-ref> <scenario> [--keep]}"
KEEP="${3:-}"
SCRIPTS="$SKILL_DIR/scripts"
HARNESS="$SKILL_DIR/harness"

BASE_SHA=$(git -C "$REPO_ROOT" rev-parse --short "$BASE_REF")
WT="$VERIFY_HOME/worktrees/$BASE_SHA"
if [ ! -d "$WT" ]; then
  log "worktree for $BASE_REF ($BASE_SHA) at $WT"
  git -C "$REPO_ROOT" worktree add --detach "$WT" "$BASE_SHA" >/dev/null 2>&1
fi

cleanup_base() {
  [ "$KEEP" = "--keep" ] && return 0
  VERIFY_PORT_OFFSET=1 "$SCRIPTS/down.sh" || true
  git -C "$REPO_ROOT" worktree remove --force "$WT" 2>/dev/null || true
}
trap cleanup_base EXIT

log "base instance (i1) from $BASE_SHA"
VERIFY_PORT_OFFSET=1 VERIFY_APP_ROOT="$WT" "$SCRIPTS/up.sh" >/dev/null
log "head instance (i0) from this checkout"
VERIFY_PORT_OFFSET=0 "$SCRIPTS/up.sh" >/dev/null

run_side() {  # run_side <offset> -> prints evidence dir
  local out
  out=$(cd "$HARNESS" && VERIFY_PORT_OFFSET="$1" node run.mjs "$SCENARIO" || true)
  python3 -c 'import json,sys; print(json.loads(sys.stdin.read())["evidence"])' <<<"$out"
}
BASE_DIR=$(run_side 1)
HEAD_DIR=$(run_side 0)

OUT="$EVIDENCE_ROOT/$(date -u +%Y-%m-%dT%H-%M-%SZ)-compare-$SCENARIO"
mkdir -p "$OUT"
cp -r "$BASE_DIR" "$OUT/base"
cp -r "$HEAD_DIR" "$OUT/head"
python3 - "$OUT" "$BASE_REF" <<'PY'
import html, json, os, sys
out, base_ref = sys.argv[1], sys.argv[2]
def side(name):
    d = os.path.join(out, name)
    res = json.load(open(os.path.join(d, "result.json")))
    shots = sorted(f for f in os.listdir(d) if f.endswith(".png"))
    return res, shots
(bres, bshots), (hres, hshots) = side("base"), side("head")
def badge(r): return f'<b style="color:{"#1a7f37" if r.get("ok") else "#cf222e"}">{"PASS" if r.get("ok") else "FAIL"}</b>'
rows = "".join(
    f'<tr><td>{f"<img src=base/{b}>" if b else ""}<div>{html.escape(b or "")}</div></td>'
    f'<td>{f"<img src=head/{h}>" if h else ""}<div>{html.escape(h or "")}</div></td></tr>'
    for b, h in __import__("itertools").zip_longest(bshots, hshots)
)
open(os.path.join(out, "compare.html"), "w").write(f"""<!doctype html><meta charset=utf-8>
<title>compare {html.escape(hres.get('label',''))}</title>
<style>body{{font:14px system-ui;margin:16px}}table{{width:100%;table-layout:fixed;border-collapse:collapse}}
td{{vertical-align:top;padding:6px;border-top:1px solid #ddd}}img,video{{width:100%}}pre{{white-space:pre-wrap;font-size:12px}}</style>
<h1>{html.escape(hres.get('label',''))}: base vs head</h1>
<table><tr><th>base: {html.escape(base_ref)} @ {bres.get('git_head')} {badge(bres)}</th><th>head: {hres.get('git_head')} {badge(hres)}</th></tr>
<tr><td><video src=base/video.webm controls muted></video></td><td><video src=head/video.webm controls muted></video></td></tr>
<tr><td><pre>{html.escape(json.dumps(bres, indent=2))}</pre></td><td><pre>{html.escape(json.dumps(hres, indent=2))}</pre></td></tr>
{rows}</table>""")
PY
log "compare written: $OUT/compare.html"
echo "$OUT"
