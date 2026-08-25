#!/usr/bin/env bash
# Packaged two-phase legacy-library acceptance for Spec 177.
set -euo pipefail
cd "$(dirname "$0")/.."

source ./scripts/e2e-profile.sh
RUN_ROOT="$(mktemp -d "${PI_SCRATCH_DIR:-${TMPDIR:-/tmp}}/lectrice-library-completeness.XXXXXX")"
export RUN_ROOT
export CARGO_TARGET_DIR="${CARGO_TARGET_DIR:-$RUN_ROOT/target}"
source ./scripts/e2e-toolchain.sh

APP_DIR="$E2E_PROFILE_DIR/com.lectrice.reader"
SOURCE_DIR="$RUN_ROOT/legacy-source"
SOURCE="$SOURCE_DIR/legacy-readable.pdf"
MISSING="$SOURCE_DIR/missing-control.pdf"
DB="$APP_DIR/pdf-reader.db"
SCOPE="$APP_DIR/.persisted-scope"
export LIBRARY_COMPLETENESS_OUT="${LIBRARY_COMPLETENESS_OUT:-$RUN_ROOT/receipt.json}"
mkdir -p "$APP_DIR" "$SOURCE_DIR"
cp public/e2e-fixture.pdf "$SOURCE"
REAL_ID="$(sha256sum "$SOURCE" | cut -d' ' -f1)"
MISSING_ID="$(printf '%s' "$MISSING" | sha256sum | cut -d' ' -f1)"
export SOURCE SOURCE_DIR MISSING DB SCOPE REAL_ID MISSING_ID

# Normal production frontend: no E2E bootstrap, fixture key, or seeded scope.
unset VITE_E2E VITE_E2E_NATIVE VITE_E2E_NATIVE_TTS VITE_E2E_NATIVE_SEED

toolchain_run 'pnpm build'
touch src-tauri/src/lib.rs

toolchain_exec '
  set -euo pipefail
  ( cd src-tauri && cargo build -j 1 )
  export WEBKIT_WEBDRIVER="$(command -v WebKitWebDriver)"
  export WEBKIT_DISABLE_COMPOSITING_MODE=1 WEBKIT_DISABLE_DMABUF_RENDERER=1 LIBGL_ALWAYS_SOFTWARE=1
  export GDK_BACKEND=x11

  DISPNUM_FILE=$(mktemp)
  Xvfb -displayfd 3 -screen 0 1280x1024x24 3>$DISPNUM_FILE >"$RUN_ROOT/xvfb.log" 2>&1 &
  XVFB_PID=$!
  OPENBOX_PID=""
  cleanup() {
    [ -z "$OPENBOX_PID" ] || kill "$OPENBOX_PID" 2>/dev/null || true
    kill "$XVFB_PID" 2>/dev/null || true
  }
  trap cleanup EXIT
  for _ in $(seq 1 100); do [ -s "$DISPNUM_FILE" ] && break; sleep 0.1; done
  DISPNUM=$(cat "$DISPNUM_FILE")
  [ -n "$DISPNUM" ] || { echo "ERROR: Xvfb failed to start" >&2; exit 1; }
  export DISPLAY=:$DISPNUM
  openbox >"$RUN_ROOT/openbox.log" 2>&1 &
  OPENBOX_PID=$!

  echo "==> phase 1: create the production profile schema"
  LIBRARY_COMPLETENESS_PHASE=bootstrap \
    E2E_SPEC=./e2e/library-completeness.e2e.mjs pnpm test:e2e
  [ -f "$DB" ] || { echo "ERROR: bootstrap did not create $DB" >&2; exit 1; }

  sqlite3 "$DB" <<SQL
.parameter init
.parameter set @real_id "$REAL_ID"
.parameter set @source "$SOURCE"
.parameter set @real_title "Legacy readable book"
.parameter set @real_stamp "2026-08-24T18:00:00Z"
.parameter set @missing_id "$MISSING_ID"
.parameter set @missing "$MISSING"
.parameter set @missing_title "Missing book control"
.parameter set @missing_stamp "2026-08-24T17:00:00Z"
INSERT INTO documents (
  id, file_path, title, page_count, current_page, scroll_position,
  last_tts_chunk_id, last_opened_at, file_hash, created_at
) VALUES (
  @real_id, @source, @real_title, 1, 1, 0,
  NULL, @real_stamp, @real_id, @real_stamp
);
INSERT INTO documents (
  id, file_path, title, page_count, current_page, scroll_position,
  last_tts_chunk_id, last_opened_at, file_hash, created_at
) VALUES (
  @missing_id, @missing, @missing_title, 1, 1, 0,
  NULL, @missing_stamp, @missing_id, @missing_stamp
);
SQL
  [ ! -e "$SCOPE" ] || { echo "ERROR: persisted scope existed before legacy recovery" >&2; exit 1; }

  echo "==> phase 2: public Settings + real cover + missing fallback"
  LIBRARY_COMPLETENESS_PHASE=verify \
    E2E_SPEC=./e2e/library-completeness.e2e.mjs pnpm test:e2e

  [ -s "$SCOPE" ] || { echo "ERROR: library listing did not persist a file grant" >&2; exit 1; }
  grep -aFq "$SOURCE" "$SCOPE" || { echo "ERROR: exact source grant absent" >&2; exit 1; }
  if grep -aFq "$SOURCE_DIR/**" "$SCOPE" || grep -aFq "$SOURCE_DIR/*" "$SCOPE"; then
    echo "ERROR: scope widened to the legacy source directory" >&2
    exit 1
  fi
  if grep -aFq "$MISSING" "$SCOPE"; then
    echo "ERROR: missing path was granted" >&2
    exit 1
  fi

  echo "==> phase 3: reader-surface Settings remains reachable"
  LIBRARY_COMPLETENESS_PHASE=reader \
    E2E_SPEC=./e2e/library-completeness.e2e.mjs pnpm test:e2e

  echo "PASS receipt=$LIBRARY_COMPLETENESS_OUT scope=$SCOPE"
'
