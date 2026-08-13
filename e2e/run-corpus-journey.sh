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
  # Fix 3: the app cache dir (app_cache_dir) resolves against XDG_CACHE_HOME on
  # Linux — point it INSIDE the hermetic profile so covers/tts_cache land
  # there (never the real home cache) and the post-verify fs cleanup check
  # can assert per-SHA absence.
  export XDG_CACHE_HOME="$XDG_DATA_HOME"
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

  # Join the committed metadata manifest (basename → pages) for the page-count
  # assertion (Codex gate #4). Fail loudly if a corpus member is unknown.
  META_MANIFEST="docs/corpus/manifest-2026-08-13.json"
  if [ ! -f "$META_MANIFEST" ]; then
    echo "FATAL: metadata manifest missing: $META_MANIFEST" >&2
    exit 3
  fi

  # One fresh app process per phase; a per-book hermetic profile subdir
  # (Fix 4: a failed book must not leak residue into the next book library).
  run_phase() {
    local phase="$1" basename="$2" sha="$3" pages="$4" log="$5" profile="$6"
    local status=0
    E2E_SPEC=./e2e/corpus-journey.e2e.mjs CORPUS_PHASE="$phase" \
      CORPUS_BASENAME="$basename" CORPUS_SHA="$sha" CORPUS_PAGES="$pages" \
      VITE_E2E_PROFILE_DIR="$profile" \
      pnpm test:e2e >"$log" 2>&1 || status=$?
    echo "    phase $phase exit: $status"
    return "$status"
  }

  record_failure() {
    # Delegates to the shared guards library — the negative controls test
    # EXACTLY this record path (scripts/corpus-guards.sh).
    guard_record "$1" "$2" "$3" "$4" "$5"
    echo "FAILED: $1 sha=$2 phase=$3 (logged to $GUARDS_FAILURES)"
  }

  # Shared guards: same logic the lightweight negative controls exercise.
  source "$E2E_REPO_ROOT/scripts/corpus-guards.sh"
  GUARDS_FAILURES="$FAILURES"
  guard_init

  build_book() {
    local basename="$1" path="$2" phase="$3" log="$4"
    echo "==> BUILD ($phase): $basename"
    if ! CI=true VITE_E2E_NATIVE=true VITE_E2E_NATIVE_TTS=none \
      VITE_E2E_PROFILE_DIR="$XDG_DATA_HOME/com.lectrice.reader" \
      VITE_E2E_OPEN_PATH="$path" pnpm build >"$log" 2>&1; then
      echo "    BUILD FAILED for $basename (see $log)"
      return 1
    fi
    touch src-tauri/src/lib.rs
    return 0
  }

  # Codex gate #6: a corpus with no PDFs (or all skipped) must fail, never
  # finish green with no real-book journey run.
  PDF_COUNT=$(echo "$CORPUS_JSON" | jq ".pdfs | length")
  if [ "$PDF_COUNT" -lt 1 ]; then
    echo "FATAL: no PDFs enumerated from LECTRICE_REAL_PDF_CORPUS" >&2
    echo "$CORPUS_JSON" | jq -r ".skipped[]? | \"  skipped: \(.basename) — \(.reason)\"" 2>/dev/null || true
    exit 3
  fi

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
    # Codex gate #4: expected page count from the committed metadata manifest.
    PAGES=$(jq -r --arg b "$BASENAME" ".pdfs[] | select(.basename == \$b) | .pages" "$META_MANIFEST")
    if [ -z "$PAGES" ] || [ "$PAGES" = "null" ]; then
      echo "FATAL: no pages entry for $BASENAME in $META_MANIFEST" >&2
      exit 3
    fi
    # Codex gate (sha validation): the enumerated file must BE the manifest
    # file — same basename AND same sha256. A same-name different-binary
    # swap must fail, not silently test an unmanifested book.
    MANIFEST_SHA=$(jq -r --arg b "$BASENAME" ".pdfs[] | select(.basename == \$b) | .sha256" "$META_MANIFEST")
    if [ -z "$MANIFEST_SHA" ] || [ "$MANIFEST_SHA" = "null" ]; then
      echo "FATAL: no sha256 entry for $BASENAME in $META_MANIFEST" >&2
      exit 3
    fi
    if [ "$SHA" != "$MANIFEST_SHA" ]; then
      echo "FATAL: enumerated sha256 for $BASENAME ($SHA) != manifest ($MANIFEST_SHA) — unmanifested binary, refusing to test" >&2
      exit 3
    fi
    # Fix 4: per-book FRESH hermetic profile (no residue from a failed book).
    BOOK_PROFILE="$XDG_DATA_HOME/book-$i"
    mkdir -p "$BOOK_PROFILE/com.lectrice.reader"
    export XDG_DATA_HOME="$BOOK_PROFILE" XDG_CONFIG_HOME="$BOOK_PROFILE" XDG_CACHE_HOME="$BOOK_PROFILE"
    echo "==> BOOK: $BASENAME (sha ${SHA:0:12}… pages=$PAGES) profile=$BOOK_PROFILE"

    # Codex gate #1: a build failure is a FAILED + recorded, not a silent skip.
    # Delegates to the shared guard (NC1 tests this exact path).
    BUILD_LOG="$RESULTS_DIR/$BASENAME.build.log"
    BUILD_STATUS=0
    build_book "$BASENAME" "$PATH_" open "$BUILD_LOG" || BUILD_STATUS=$?
    if ! guard_build_status "$BUILD_STATUS" "$BASENAME" "$SHA" \
      "VITE_E2E_OPEN_PATH=$PATH_ pnpm build" "$BUILD_LOG"; then
      FAILED=1
      continue
    fi
    # cargo build once (cached across books)
    ( cd src-tauri && cargo build --features e2e-tts-fixture >/dev/null 2>&1 ) || { echo "CARGO BUILD FAILED"; exit 3; }

    # open phase
    LOG="$RESULTS_DIR/$BASENAME.open.log"
    if ! run_phase open "$BASENAME" "$SHA" "$PAGES" "$LOG" "$BOOK_PROFILE/com.lectrice.reader"; then
      record_failure "$BASENAME" "$SHA" open \
        "E2E_SPEC=./e2e/corpus-journey.e2e.mjs CORPUS_PHASE=open CORPUS_BASENAME=$BASENAME CORPUS_SHA=$SHA pnpm test:e2e" "$LOG"
      FAILED=1
      continue
    fi

    # card-open phase (same book profile — the book is now a library row;
    # re-checks the Mac AXPress card-open failure on Linux)
    LOG="$RESULTS_DIR/$BASENAME.card-open.log"
    if ! run_phase card-open "$BASENAME" "$SHA" "$PAGES" "$LOG" "$BOOK_PROFILE/com.lectrice.reader"; then
      record_failure "$BASENAME" "$SHA" card-open \
        "E2E_SPEC=./e2e/corpus-journey.e2e.mjs CORPUS_PHASE=card-open CORPUS_BASENAME=$BASENAME CORPUS_SHA=$SHA pnpm test:e2e" "$LOG"
      FAILED=1
      continue
    fi

    # Codex gate #5: cover-cache proof — after card-open, a cover-capable
    # build must have a real cached raster at covers/{SHA}-* whose sha256 is
    # recorded for cross-book distinctness. A cover-capable base whose spec
    # DIAG shows a cover surface but no cache file is a FAIL; a base with no
    # cover surface is BLOCKED-not-green.
    COVER_CACHE_FILE=$(find "$BOOK_PROFILE" -path "*covers*" -name "${SHA}-*" -type f 2>/dev/null | head -1)
    BLOBSHA=$(grep -o "\"contentSha256\":\"[0-9a-f]*" "$RESULTS_DIR/$BASENAME.card-open.log" 2>/dev/null | head -1 | sed "s/.*:\"//")
    if [ -n "$COVER_CACHE_FILE" ]; then
      COVER_FILE_SHA=$(sha256sum "$COVER_CACHE_FILE" | cut -d" " -f1)
      echo "    cover-cache proof: $COVER_CACHE_FILE sha256=${COVER_FILE_SHA:0:16}…"
      echo -e "$BASENAME\t$SHA\t$COVER_FILE_SHA" >> "$RESULTS_DIR/cover-hashes.tsv"
      # Rendered blob hash must exist AND match the cached file hash (NC5
      # guard — the deterministic control tests this exact path).
      if ! guard_cover_hash_match "$BLOBSHA" "$COVER_FILE_SHA" "$BASENAME" "$SHA" \
        "rendered blob vs cached covers/${SHA}-*" "$RESULTS_DIR/$BASENAME.card-open.log"; then
        FAILED=1
      else
        echo "    cover-tie OK: $BASENAME rendered==cached (${COVER_FILE_SHA:0:12}…)"
      fi
    elif [ -n "$BLOBSHA" ]; then
      # NC5 one-sided evidence: rendered blob with no cache file is a FAIL
      # (guard_cover_hash_match blob-present/file-empty arm).
      if ! guard_cover_hash_match "$BLOBSHA" "" "$BASENAME" "$SHA" \
        "rendered cover blob but no cached file at covers/${SHA}-*" "$RESULTS_DIR/$BASENAME.card-open.log"; then
        FAILED=1
      fi
    else
      # No cover surface on this base — both-empty, BLOCKED-not-green (NC6).
      guard_missing_oracle cover-proof-blocked "$BASENAME" "$SHA" \
        "no covers/{SHA}-* cache file recorded (pre-121 base)" "$RESULTS_DIR/$BASENAME.card-open.log" \
        "    cover-cache BLOCKED: no covers/{SHA}-* file on this base (pre-121); owner 121-cover-pipeline"
      FAILED=1
    fi

    # PRE-delete tts oracle (Codex gate: the post-delete zero is only
    # meaningful when a row existed before delete). Queried NOW, before the
    # verify phase deletes the document.
    DB="$BOOK_PROFILE/com.lectrice.reader/pdf-reader.db"
    TTS_PRE=0
    if [ -f "$DB" ]; then
      TTS_PRE=$(sqlite3 -readonly "$DB" "SELECT COUNT(*) FROM tts_cache_metadata WHERE document_id = \"$SHA\";" 2>/dev/null || echo "query-failed")
    else
      TTS_PRE="no-db"
    fi
    echo "    tts pre-delete rows for ${SHA:0:12}: $TTS_PRE"

    # verify phase (same book profile, fresh app process; restore + delete)
    LOG="$RESULTS_DIR/$BASENAME.verify.log"
    if ! run_phase verify "$BASENAME" "$SHA" "$PAGES" "$LOG" "$BOOK_PROFILE/com.lectrice.reader"; then
      record_failure "$BASENAME" "$SHA" verify \
        "E2E_SPEC=./e2e/corpus-journey.e2e.mjs CORPUS_PHASE=verify CORPUS_BASENAME=$BASENAME CORPUS_SHA=$SHA pnpm test:e2e" "$LOG"
      FAILED=1
    else
      # Fix 3 (Codex gate): cache-cleanup checks after delete. TWO surfaces:
      # (a) cover cache files keyed by document SHA in app_cache_dir/covers;
      # (b) SQLite tts_cache_metadata rows whose document_id = SHA. The
      # pre-delete TTS_PRE was captured BEFORE the verify phase deleted the
      # document (see above) — only a pre-existing row makes the post-delete
      # zero meaningful.
      CACHE_ROOT="$BOOK_PROFILE/com.lectrice.reader"

      # (b) tts: post-delete count vs the captured pre-delete count.
      if [ "$TTS_PRE" = "query-failed" ] || [ -z "$TTS_PRE" ] || [ "$TTS_PRE" = "no-db" ]; then
        guard_missing_oracle cache-cleanup-blocked "$BASENAME" "$SHA" \
          "sqlite3 tts_cache_metadata query unavailable (pre-delete count)" "$RESULTS_DIR/$BASENAME.verify.log" \
          "    cache-cleanup BLOCKED (FAILED): tts oracle unavailable (pre=$TTS_PRE) — audio-cleanup not provable on this base"
        FAILED=1
      elif [ "$TTS_PRE" -eq 0 ]; then
        guard_missing_oracle cache-cleanup-blocked "$BASENAME" "$SHA" \
          "tts_cache_metadata pre-delete count = 0 — cleanup unprovable without a created row" "$RESULTS_DIR/$BASENAME.verify.log" \
          "    cache-cleanup BLOCKED (FAILED): no pre-delete tts_cache_metadata row — post-delete zero would be vacuous (TTS=none base)"
        FAILED=1
      else
        TTS_POST=$(sqlite3 -readonly "$DB" "SELECT COUNT(*) FROM tts_cache_metadata WHERE document_id = \"$SHA\";" 2>/dev/null || echo "query-failed")
        if [ "$TTS_POST" = "query-failed" ]; then
          guard_missing_oracle cache-cleanup-blocked "$BASENAME" "$SHA" \
            "sqlite3 tts_cache_metadata post-delete query failed" "$RESULTS_DIR/$BASENAME.verify.log" \
            "    cache-cleanup BLOCKED (FAILED): post-delete tts query failed"
          FAILED=1
        elif [ "$TTS_POST" -gt 0 ]; then
          echo "    cache-cleanup FAIL: $TTS_POST tts_cache_metadata row(s) remain for ${SHA:0:12} (pre=$TTS_PRE)"
          record_failure "$BASENAME" "$SHA" cache-cleanup \
            "sqlite3 tts_cache_metadata post-delete count = $TTS_POST (pre=$TTS_PRE)" "$RESULTS_DIR/$BASENAME.verify.log"
          FAILED=1
        else
          echo "    cache-cleanup OK: tts rows for ${SHA:0:12} dropped (pre=$TTS_PRE post=0)"
        fi
      fi

      # (a) cover-cache fs check: a cover-capable build must have had a
      # covers/{SHA}-* file (recorded after card-open) and it must be GONE
      # after delete. A base with no cover surface is BLOCKED-not-green.
      COVER_LEFT=$(find "$CACHE_ROOT" -path "*covers*" -name "${SHA}-*" 2>/dev/null | head -5)
      if ! guard_cache_leftover "$COVER_LEFT" "$BASENAME" "$SHA" \
        "find $CACHE_ROOT -path *covers* -name ${SHA}-* (post-verify)" "$RESULTS_DIR/$BASENAME.verify.log"; then
        FAILED=1
      elif [ -d "$CACHE_ROOT/covers" ] || [ -d "$CACHE_ROOT/app_cache" ]; then
        echo "    cache-cleanup OK: no ${SHA:0:12}-keyed cover files remain"
      else
        guard_missing_oracle cache-cleanup-blocked "$BASENAME" "$SHA" \
          "no covers/ dir in $CACHE_ROOT — cover-cleanup unprovable pre-121" "$RESULTS_DIR/$BASENAME.verify.log" \
          "    cache-cleanup BLOCKED (FAILED): no cover-cache dir on this base (pre-121)"
        FAILED=1
      fi
    fi
  done

  # ── NEGATIVE CONTROLS (Codex gate: always exercised, never skipped). ──
  # (1) corrupt-control: a hermetic garbage .pdf (generated here, never a
  # corpus file) must surface PDF_INVALID after a bounded settle.
  echo "==> corrupt negative control"
  CORRUPT_PATH="$XDG_DATA_HOME/corrupt-control.pdf"
  printf "%%PDF-1.7 this is not a real pdf %s\n" "$(date +%s)" > "$CORRUPT_PATH"
  BUILD_LOG="$RESULTS_DIR/corrupt-control.build.log"
  if ! build_book "corrupt-control.pdf" "$CORRUPT_PATH" corrupt-control "$BUILD_LOG"; then
    record_failure "corrupt-control.pdf" "generated" build \
      "VITE_E2E_OPEN_PATH=$CORRUPT_PATH pnpm build" "$BUILD_LOG"
    FAILED=1
  else
    LOG="$RESULTS_DIR/corrupt-control.log"
    CORRUPT_STATUS=0
    E2E_SPEC=./e2e/corpus-journey.e2e.mjs CORPUS_PHASE=corrupt-control \
      CORPUS_BASENAME="corrupt-control.pdf" CORPUS_SHA="generated" CORPUS_PAGES=0 \
      pnpm test:e2e >"$LOG" 2>&1 || CORRUPT_STATUS=$?
    echo "    corrupt-control exit: $CORRUPT_STATUS (0 = PDF_INVALID surfaced)"
    if [ "$CORRUPT_STATUS" -ne 0 ]; then
      record_failure "corrupt-control.pdf" "generated" corrupt-control \
        "E2E_SPEC=./e2e/corpus-journey.e2e.mjs CORPUS_PHASE=corrupt-control pnpm test:e2e" "$LOG"
      FAILED=1
    fi
  fi

  # (2) EPUB negative control: the open flow must refuse it with PDF_INVALID.
  # A corpus WITHOUT an epub is a MISSING control — recorded as a failure
  # (Codex gate: absence of a negative control is not green).
  EPUB_COUNT=$(echo "$CORPUS_JSON" | jq ".epub | length")
  if [ "$EPUB_COUNT" -gt 0 ]; then
    EPUB_PATH=$(echo "$CORPUS_JSON" | jq -r ".epub[0].path")
    EPUB_SHA=$(echo "$CORPUS_JSON" | jq -r ".epub[0].sha256")
    EPUB_NAME=$(basename "$EPUB_PATH")
    # Codex gate: the enumerated EPUB must match the manifest (same basename
    # AND sha256) — a swapped/edited EPUB must refuse to run the control.
    # Delegates to the shared guard (NC2 tests this exact path).
    EPUB_MANIFEST_SHA=$(jq -r --arg b "$EPUB_NAME" ".epub[] | select(.basename == \$b) | .sha256" "$META_MANIFEST")
    guard_epub_manifest "$EPUB_SHA" "$EPUB_MANIFEST_SHA" "$EPUB_NAME" || exit 3
    echo "==> EPUB negative control: $EPUB_NAME (manifest sha verified)"
    BUILD_LOG="$RESULTS_DIR/epub-control.build.log"
    if ! build_book "$EPUB_NAME" "$EPUB_PATH" epub-control "$BUILD_LOG"; then
      record_failure "$EPUB_NAME" "$EPUB_SHA" build \
        "VITE_E2E_OPEN_PATH=$EPUB_PATH pnpm build" "$BUILD_LOG"
      FAILED=1
    else
      LOG="$RESULTS_DIR/epub-control.log"
      EPUB_STATUS=0
      E2E_SPEC=./e2e/corpus-journey.e2e.mjs CORPUS_PHASE=epub-control \
        CORPUS_BASENAME="$EPUB_NAME" CORPUS_SHA="$EPUB_SHA" CORPUS_PAGES=0 \
        pnpm test:e2e >"$LOG" 2>&1 || EPUB_STATUS=$?
      echo "    epub-control exit: $EPUB_STATUS (0 = explicit refusal surfaced; non-zero = control FAILED)"
      if [ "$EPUB_STATUS" -ne 0 ]; then
        record_failure "$EPUB_NAME" "$EPUB_SHA" epub-control \
          "E2E_SPEC=./e2e/corpus-journey.e2e.mjs CORPUS_PHASE=epub-control CORPUS_BASENAME=$EPUB_NAME CORPUS_SHA=$EPUB_SHA pnpm test:e2e" "$LOG"
        FAILED=1
      fi
    fi
  else
    echo "==> FAIL: no EPUB in corpus — negative control missing (Codex gate: not green)"
    record_failure "(missing epub)" "(none)" epub-control \
      "corpus has no .epub file to exercise the unsupported-format refusal" "(none)"
    FAILED=1
  fi

  # Codex gate #7: cross-book cover evidence. Per-book rendered==cached ties
  # ran pre-verify (cover-tie); here: (a) every book must have a recorded
  # cover hash (full coverage — a subset passing is false-green), and (b) all
  # cached cover hashes must be mutually distinct (real per-book first pages,
  # not a shared placeholder).
  if [ -s "$RESULTS_DIR/cover-hashes.tsv" ]; then
    COVER_ROW_COUNT=$(wc -l < "$RESULTS_DIR/cover-hashes.tsv")
    # Delegates to the shared guard (NC3 tests this exact path).
    if ! guard_cover_count "$COVER_ROW_COUNT" "$PDF_COUNT" "$RESULTS_DIR/cover-hashes.tsv"; then
      FAILED=1
    else
      echo "==> Cover-hash cross-checks (all $COVER_ROW_COUNT/$PDF_COUNT books)"
    fi
    DUPES=$(cut -f3 "$RESULTS_DIR/cover-hashes.tsv" | sort | uniq -d)
    if [ -n "$DUPES" ]; then
      echo "    cover-distinct FAIL: identical cover hashes across books: $DUPES"
      record_failure "(cross-book)" "(multiple)" cover-distinct \
        "duplicate cover content hashes in cover-hashes.tsv" "$RESULTS_DIR/cover-hashes.tsv"
      FAILED=1
    else
      echo "    cover-distinct OK: all $COVER_ROW_COUNT covers distinct"
    fi
  else
    echo "==> Cover-hash cross-checks BLOCKED (FAILED): no cover-hashes.tsv — no cover cache proof on this base"
    guard_missing_oracle cover-proof-blocked "(all books)" "(none)" \
      "no covers/{SHA}-* cache files recorded (pre-121 base)" "$RESULTS_DIR" \
      "==> Cover-hash cross-checks BLOCKED (FAILED): no cover-hashes.tsv — no cover cache proof on this base"
    FAILED=1
  fi

  echo "==> ALL DONE. failures:"
  cat "$FAILURES"
  exit $(( FAILED || GUARDS_FAILED ))
'
