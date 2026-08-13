#!/usr/bin/env bash
#
# run-corpus-journey.sh — packaged real-book corpus lane.
#
# For EVERY book in LECTRICE_REAL_PDF_CORPUS (private, never copied into the
# repo): build the packaged app once with VITE_E2E_OPEN_PATH=<real book path>
# (the WebDriver-impossible dialog seam), run the corpus journey open phase,
# relaunch and run the verify phase (restore + delete + cleanup), and record
# the outcome. Failures are recorded with basename + SHA + phase + command;
# book bytes never enter git or CI artifacts. Failure records land in
# $RESULTS_DIR/failures.tsv for the operator to post to GitHub issue #120.
#
# The EPUB in the corpus is the unsupported-format negative control: the
# open seam is exercised with it once (expected refusal), recorded, not
# treated as a product defect.
#
# Usage:  LECTRICE_REAL_PDF_CORPUS="/path/to/books" bash e2e/run-corpus-journey.sh
#
# Honors the shared flock:  flock /tmp/lectrice-heavy-gate.lock -c '…'

set -euo pipefail
cd "$(dirname "$0")/.."
export E2E_REPO_ROOT="$PWD"

if [ -z "${LECTRICE_REAL_PDF_CORPUS:-}" ]; then
  echo "FATAL: LECTRICE_REAL_PDF_CORPUS must point at the private corpus dir" >&2
  exit 2
fi
[ -d "$LECTRICE_REAL_PDF_CORPUS" ] || { echo "FATAL: corpus dir missing: $LECTRICE_REAL_PDF_CORPUS" >&2; exit 2; }

RESULTS_DIR="${CORPUS_RESULTS_DIR:-/tmp/lectrice-corpus-results-$(date +%Y%m%d-%H%M%S)}"
mkdir -p "$RESULTS_DIR"
FAILURES="$RESULTS_DIR/failures.tsv"
: > "$FAILURES"
echo "==> Results dir: $RESULTS_DIR"

export CI=true
source ./scripts/e2e-profile.sh
source ./scripts/e2e-toolchain.sh
export LECTRICE_REAL_PDF_CORPUS
export RESULTS_DIR FAILURES E2E_REPO_ROOT

toolchain_exec '
  set -euo pipefail
  export WEBKIT_WEBDRIVER="$(command -v WebKitWebDriver)"
  export WEBKIT_DISABLE_COMPOSITING_MODE=1 WEBKIT_DISABLE_DMABUF_RENDERER=1 LIBGL_ALWAYS_SOFTWARE=1
  export GDK_BACKEND=x11
  DISPNUM_FILE=$(mktemp)
  Xvfb -displayfd 3 -screen 0 1280x1024x24 3>$DISPNUM_FILE >/tmp/lectrice-e2e-corpus-xvfb.log 2>&1 &
  XVFB_PID=$!
  trap "kill $XVFB_PID 2>/dev/null || true" EXIT
  for _ in $(seq 1 100); do [ -s "$DISPNUM_FILE" ] && break; sleep 0.1; done
  export DISPLAY=:$(cat "$DISPNUM_FILE")
  echo "Xvfb ready on DISPLAY=$DISPLAY profile=$XDG_DATA_HOME"

  cd "$E2E_REPO_ROOT"
  CORPUS_JSON="$(LECTRICE_REAL_PDF_CORPUS="$LECTRICE_REAL_PDF_CORPUS" node scripts/corpus-enumerate.mjs)"
  echo "$CORPUS_JSON" | jq -r ".pdfs[] | \"pdf  \(.basename)  \(.size) B  sha \(.sha256[0:12])…\"" 2>/dev/null || echo "$CORPUS_JSON" | head -20

  # One fresh app process per phase; a per-book hermetic profile subdir.
  run_phase() {
    local phase="$1" basename="$2" sha="$3" pages="$4" log="$5"
    local status=0
    E2E_SPEC=./e2e/corpus-journey.e2e.mjs CORPUS_PHASE="$phase" \
      CORPUS_BASENAME="$basename" CORPUS_SHA="$sha" CORPUS_PAGES="$pages" \
      pnpm test:e2e >"$log" 2>&1 || status=$?
    echo "    phase $phase exit: $status"
    return "$status"
  }

  record_failure() {
    local basename="$1" sha="$2" phase="$3" cmd="$4" log="$5"
    printf "%s\t%s\t%s\t%s\t%s\n" "$basename" "$sha" "$phase" "$cmd" "$log" >> "$FAILURES"
    echo "FAILED: $basename sha=$sha phase=$phase (logged to $FAILURES)"
  }

  build_book() {
    local basename="$1" path="$2" phase="$3"
    echo "==> BUILD ($phase): $basename"
    CI=true VITE_E2E_NATIVE=true VITE_E2E_NATIVE_TTS=none VITE_E2E_NATIVE_SEED=none \
      VITE_E2E_PROFILE_DIR="$XDG_DATA_HOME/com.lectrice.reader" \
      VITE_E2E_OPEN_PATH="$path" pnpm build >/dev/null
    touch src-tauri/src/lib.rs
  }

  FAILED=0
  PDF_COUNT=$(echo "$CORPUS_JSON" | jq ".pdfs | length")
  # LECTRICE_CORPUS_MAX: run only the first N books (smoke / CI slices).
  if [ -n "${LECTRICE_CORPUS_MAX:-}" ]; then
    PDF_COUNT=$(( PDF_COUNT < LECTRICE_CORPUS_MAX ? PDF_COUNT : LECTRICE_CORPUS_MAX ))
    echo "==> LECTRICE_CORPUS_MAX=$LECTRICE_CORPUS_MAX — running first $PDF_COUNT book(s)"
  fi
  for i in $(seq 0 $((PDF_COUNT - 1))); do
    BASENAME=$(echo "$CORPUS_JSON" | jq -r ".pdfs[$i].basename")
    SHA=$(echo "$CORPUS_JSON" | jq -r ".pdfs[$i].sha256")
    PATH_=$(echo "$CORPUS_JSON" | jq -r ".pdfs[$i].path")
    PAGES=0   # pages come from the manifest; the lane asserts 1→2 only
    echo "==> BOOK: $BASENAME (sha ${SHA:0:12}…)"

    # Pages are manifest metadata, not enumerator output — the lane asserts
    # only "page 1 → Next → page 2" and "restore lands on 2", so PAGES is
    # informational (0 = not asserted).
    build_book "$BASENAME" "$PATH_" open || { echo "BUILD FAILED for $BASENAME"; continue; }
    # cargo build once (cached across books)
    ( cd src-tauri && cargo build --features e2e-tts-fixture >/dev/null 2>&1 ) || { echo "CARGO BUILD FAILED"; exit 3; }

    # open phase
    LOG="$RESULTS_DIR/$BASENAME.open.log"
    if ! run_phase open "$BASENAME" "$SHA" "$PAGES" "$LOG"; then
      record_failure "$BASENAME" "$SHA" open \
        "E2E_SPEC=./e2e/corpus-journey.e2e.mjs CORPUS_PHASE=open CORPUS_BASENAME=$BASENAME CORPUS_SHA=$SHA pnpm test:e2e" "$LOG"
      FAILED=1
      continue
    fi

    # card-open phase (same profile — the book is now a library row; re-checks
    # the Mac AXPress card-open failure on Linux)
    LOG="$RESULTS_DIR/$BASENAME.card-open.log"
    if ! run_phase card-open "$BASENAME" "$SHA" "$PAGES" "$LOG"; then
      record_failure "$BASENAME" "$SHA" card-open \
        "E2E_SPEC=./e2e/corpus-journey.e2e.mjs CORPUS_PHASE=card-open CORPUS_BASENAME=$BASENAME CORPUS_SHA=$SHA pnpm test:e2e" "$LOG"
      FAILED=1
      continue
    fi

    # verify phase (same build, fresh app process; restore + delete)
    LOG="$RESULTS_DIR/$BASENAME.verify.log"
    if ! run_phase verify "$BASENAME" "$SHA" "$PAGES" "$LOG"; then
      record_failure "$BASENAME" "$SHA" verify \
        "E2E_SPEC=./e2e/corpus-journey.e2e.mjs CORPUS_PHASE=verify CORPUS_BASENAME=$BASENAME CORPUS_SHA=$SHA pnpm test:e2e" "$LOG"
      FAILED=1
    fi
  done

  # EPUB negative control: the open flow must refuse it (filter is .pdf).
  EPUB_COUNT=$(echo "$CORPUS_JSON" | jq ".epub | length")
  if [ "$EPUB_COUNT" -gt 0 ]; then
    EPUB_PATH=$(echo "$CORPUS_JSON" | jq -r ".epub[0].path")
    EPUB_SHA=$(echo "$CORPUS_JSON" | jq -r ".epub[0].sha256")
    echo "==> EPUB negative control: $(basename "$EPUB_PATH")"
    build_book "$(basename "$EPUB_PATH")" "$EPUB_PATH" epub-control
    LOG="$RESULTS_DIR/epub-control.log"
    EPUB_STATUS=0
    E2E_SPEC=./e2e/corpus-journey.e2e.mjs CORPUS_PHASE=epub-control \
      CORPUS_BASENAME="$(basename "$EPUB_PATH")" CORPUS_SHA="$EPUB_SHA" CORPUS_PAGES=0 \
      pnpm test:e2e >"$LOG" 2>&1 || EPUB_STATUS=$?
    echo "    epub-control exit: $EPUB_STATUS (expected non-zero: refusal)"
    # Expected refusal = the open flow rejects the epub (exit non-zero is the
    # NEGATIVE control passing if the phase records a clean refusal).
    grep -q "expected refusal\|epub" "$LOG" || true
  fi

  echo "==> ALL DONE. failures:"
  cat "$FAILURES"
  exit "$FAILED"
'
