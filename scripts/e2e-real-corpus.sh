#!/usr/bin/env bash
#
# scripts/e2e-real-corpus.sh — the REAL-corpus soak tier of the packaged user
# gate (post-merge/manual; NEVER on PRs — PR-fast stays deterministic).
#
# What it does: for every PDF in $LECTRICE_REAL_PDF_CORPUS, stages a
# TRANSIENT copy inside the hermetic profile's applocaldata (the only path
# in fs scope — no capability widening), builds the VITE_E2E bridge app once,
# and runs three packaged phases per book — open/render/navigate, genuine
# fast close (WM_DELETE_WINDOW, < 500 ms), relaunch+verify — via
# e2e/real-corpus.e2e.mjs.
#
# Copyright boundary (never stores copyrighted PDFs/artifacts):
#   - the staged copy lives in a mktemp profile that this script's trap
#     deletes; it is never uploaded, never embedded in a build, never moved
#     outside the host;
#   - outputs are per-book/phase logs and one machine-readable summary.json;
#   - the artifact set in the calling workflow MUST NOT include the profile
#     dir or the corpus dir (logs + summary only).
#
# Usage:
#   LECTRICE_REAL_PDF_CORPUS=/path/to/books bash scripts/e2e-real-corpus.sh
#
# Outputs:
#   /tmp/lectrice-corpus/<sanitized-book>/<phase>.log   full per-phase logs
#   /tmp/lectrice-corpus/summary.json                   machine-readable
#   exit 0 iff every phase of every book passed.
set -uo pipefail
cd "$(dirname "$0")/.."

CORPUS="${LECTRICE_REAL_PDF_CORPUS:-}"
if [ -z "$CORPUS" ] || [ ! -d "$CORPUS" ]; then
  echo "BLOCKED: LECTRICE_REAL_PDF_CORPUS must name an existing LOCAL directory (never a URL)" >&2
  exit 2
fi

OUT=/tmp/lectrice-corpus
rm -rf "$OUT"
mkdir -p "$OUT"

source ./scripts/e2e-profile.sh
source ./scripts/e2e-toolchain.sh
# The sourced helpers enable errexit for THEIR internal safety; this script
# manages per-phase failures explicitly (RC capture, summary append, keep
# going through the remaining books/phases). Disable errexit again here.
set +e
APP_DIR="$E2E_PROFILE_DIR/com.lectrice.reader"
mkdir -p "$APP_DIR"
# The staged corpus copy + app profile are TRANSIENT: always deleted, on
# success and on failure. The evidence dir (logs + summary) is intentionally
# NOT in this trap — it is the hook's only output.
trap 'rm -rf "$E2E_PROFILE_DIR"' EXIT

# Books are discovered ONCE (sorted) so a summary re-run is reproducible.
mapfile -t BOOKS < <(find "$CORPUS" -maxdepth 1 -type f -iname '*.pdf' | sort)
if [ "${#BOOKS[@]}" -eq 0 ]; then
  echo "BLOCKED: no *.pdf files in LECTRICE_REAL_PDF_CORPUS=$CORPUS" >&2
  exit 2
fi
echo "corpus: ${#BOOKS[@]} books from $CORPUS"
for b in "${BOOKS[@]}"; do echo "  - $(basename "$b") ($(du -h "$b" | cut -f1))"; done

echo "==> Building frontend (VITE_E2E bridge, one build for all books)"
VITE_E2E=true pnpm build
touch src-tauri/src/lib.rs

# The packaged lane launches src-tauri/target/debug/tauri-pdf-reader — the
# binary MUST be built from THIS head before any phase runs (a stale binary
# would pass the journey against old code). One build, shared by all books.
echo "==> Building the debug binary (one build for all books)"
toolchain_run 'set -euo pipefail; ( cd src-tauri && cargo build )' >/tmp/lectrice-corpus-cargo-build.log 2>&1
BUILD_RC=$?
if [ $BUILD_RC -ne 0 ]; then
  echo "BLOCKED: cargo build failed (rc=$BUILD_RC) — log: /tmp/lectrice-corpus-cargo-build.log"
  printf '{"blocked":"cargo build failed","phase":"build","exit_code":%d}\n' "$BUILD_RC" >"$OUT/summary.json"
  exit 1
fi

# Optional per-book expected page counts, hosted NEXT TO the corpus (never in
# git, never uploaded): { "<filename>": 337, ... }. When present, the lane
# asserts the real totalPages against it (a generated 11-page PDF would fail
# the expected-count oracle).
MANIFEST="$CORPUS/manifest.json"
if [ ! -f "$MANIFEST" ]; then MANIFEST=""; fi

# Machine-readable summary; per-book phase results appended as they land.
# The corpus field is the BASENAME only — the absolute host path is never
# uploaded.
SUMMARY="$OUT/summary.json"
echo '{"corpus":"'"$(basename "$CORPUS")"'","books":[],"exit":0}' >"$SUMMARY"

STATUS=0
for BOOK in "${BOOKS[@]}"; do
  NAME="$(basename "$BOOK" .pdf | tr ' /' '__')"
  BOUT="$OUT/$NAME"
  mkdir -p "$BOUT"
  # Transient staging: the ONLY in-scope read path (fs scope = applocaldata).
  # Deleted by this script's trap; never uploaded (see header).
  STAGED="$APP_DIR/real-corpus-book.pdf"
  cp "$BOOK" "$STAGED"
  SHA256=$(sha256sum "$BOOK" | cut -d' ' -f1)
  echo "===== BOOK $NAME ($SHA256) ====="

  EXPECTED=""
  if [ -n "$MANIFEST" ]; then
    EXPECTED=$(python3 -c "import json;print(json.load(open('$MANIFEST')).get('$(basename "$BOOK")',''))" 2>/dev/null)
  fi

  for PHASE in open close verify; do
    LOG="$BOUT/$PHASE.log"
    echo "  -- phase $PHASE"
    if E2E_CORPUS_PHASE="$PHASE" E2E_CORPUS_BOOK="$STAGED" E2E_CORPUS_EXPECTED_PAGES="$EXPECTED" \
      toolchain_run "
        set -euo pipefail
        export WEBKIT_WEBDRIVER=\"\$(command -v WebKitWebDriver)\"
        export WEBKIT_DISABLE_COMPOSITING_MODE=1 WEBKIT_DISABLE_DMABUF_RENDERER=1 LIBGL_ALWAYS_SOFTWARE=1
        export GDK_BACKEND=x11
        DISPNUM_FILE=\$(mktemp)
        Xvfb -displayfd 3 -screen 0 1280x1024x24 3>\$DISPNUM_FILE >/tmp/lectrice-corpus-xvfb.log 2>&1 &
        XVFB_PID=\$!
        trap \"kill \$XVFB_PID 2>/dev/null || true\" EXIT
        for _ in \$(seq 1 100); do [ -s \$DISPNUM_FILE ] && break; sleep 0.1; done
        export DISPLAY=:\$(cat \$DISPNUM_FILE)
        E2E_SPEC=./e2e/real-corpus.e2e.mjs pnpm test:e2e
      " >"$LOG" 2>&1; then
      RC=0
    else
      RC=$?
    fi
    if [ $RC -eq 0 ]; then
      echo "  -- phase $PHASE PASS"
      RESULT=pass
    else
      echo "  -- phase $PHASE FAIL (rc=$RC) — $LOG"
      RESULT=fail
      STATUS=1
    fi
    # Append this book-phase result to the machine-readable summary.
    python3 - "$SUMMARY" "$NAME" "$PHASE" "$RESULT" "$RC" "$SHA256" <<'PY'
import json, sys
path, name, phase, result, rc, sha = sys.argv[1:7]
d = json.load(open(path))
book = next((b for b in d["books"] if b["name"] == name), None)
if book is None:
    book = {"name": name, "sha256": sha, "phases": {}}
    d["books"].append(book)
book["phases"][phase] = {"result": result, "exit_code": int(rc)}
json.dump(d, open(path, "w"), indent=2)
PY
  done
done

# The profile was transient and is already gone (trap covers failures).

if [ "$STATUS" -ne 0 ]; then
  python3 -c "import json;d=json.load(open('$SUMMARY'));d['exit']=1;json.dump(d,open('$SUMMARY','w'),indent=2)"
  echo "CORPUS: one or more book phases failed — summary: $SUMMARY"
  exit 1
fi
echo "CORPUS: all ${#BOOKS[@]} books passed — summary: $SUMMARY"
