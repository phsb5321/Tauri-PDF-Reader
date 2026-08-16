#!/usr/bin/env bash
#
# Reproducible runner for the packaged delete-journey E2E
# (e2e/delete-journey.e2e.mjs) — two phases over ONE hermetic profile:
#
#   phase seed   — app boots, the seeded fixture card is asserted visible,
#                  the app closes (the deterministic "app closed" point).
#                  The observer then pre-seeds ONE real cache entry (the
#                  exact shape `SqliteAudioCacheRepo::store` leaves: a
#                  tts_cache_metadata row + a `{cache_key}.mp3` in
#                  `$XDG_CACHE_HOME/com.lectrice.reader/tts_cache/`).
#   phase delete — the app RELAUNCHES on the same profile (the seeded row
#                  and file must survive it); the actor clicks the card's
#                  public delete button; the build-time seam accepts the
#                  WebDriver-impossible native confirm; the lane asserts the
#                  card leaves the surface and the library row is gone.
#                  The RUNNER then asserts the file and metadata halves:
#                  documents row gone, tts_cache_metadata row gone, the
#                  seeded .mp3 gone from disk.
#
# Inherits the shared entry points — NO hand-rolled profile or package list:
#   scripts/e2e-profile.sh   (hermetic XDG_* profile, #99)
#   scripts/e2e-toolchain.sh (flake devShell toolchain, #101)
# The shared profile helper covers XDG_DATA_HOME + XDG_CONFIG_HOME only; the
# audio cache lives under app_cache_dir ($XDG_CACHE_HOME), so this runner
# points it into the same temp profile — a lane that forgets this would seed
# and assert against the REAL user cache.
#
# Run from anywhere:   bash e2e/run-delete-journey.sh
set -euo pipefail
cd "$(dirname "$0")/.."

source ./scripts/e2e-profile.sh
source ./scripts/e2e-toolchain.sh
export XDG_CACHE_HOME="$E2E_PROFILE_DIR"

APP_DIR="$E2E_PROFILE_DIR/com.lectrice.reader"
CACHE_DIR="$XDG_CACHE_HOME/com.lectrice.reader/tts_cache"
mkdir -p "$APP_DIR" "$CACHE_DIR"
node scripts/gen-e2e-fixtures.mjs "$APP_DIR" >/dev/null

echo "==> Building frontend (VITE_E2E_NATIVE=true, seed=single) once — the flags are identical for both phases"
export CI=true
CI=true VITE_E2E_NATIVE=true VITE_E2E_NATIVE_TTS=none VITE_E2E_NATIVE_SEED=single \
  VITE_E2E_PROFILE_DIR="$APP_DIR" pnpm build >/dev/null
touch src-tauri/src/lib.rs

toolchain_exec '
  set -euo pipefail
  ( cd src-tauri && cargo build --features e2e-tts-fixture >/dev/null 2>&1 )
  export WEBKIT_WEBDRIVER="$(command -v WebKitWebDriver)"
  export WEBKIT_DISABLE_COMPOSITING_MODE=1 WEBKIT_DISABLE_DMABUF_RENDERER=1 LIBGL_ALWAYS_SOFTWARE=1
  export GDK_BACKEND=x11
  DISPNUM_FILE=$(mktemp)
  Xvfb -displayfd 3 -screen 0 1280x1024x24 3>$DISPNUM_FILE >/tmp/lectrice-e2e-delete-xvfb.log 2>&1 &
  XVFB_PID=$!
  trap "kill $XVFB_PID 2>/dev/null || true" EXIT
  for _ in $(seq 1 100); do [ -s $DISPNUM_FILE ] && break; sleep 0.1; done
  export DISPLAY=:$(cat $DISPNUM_FILE)
  echo "Xvfb ready on DISPLAY=$DISPLAY profile=$XDG_DATA_HOME cache=$XDG_CACHE_HOME"

  DB="$XDG_CONFIG_HOME/com.lectrice.reader/pdf-reader.db"
  CACHE_DIR="$XDG_CACHE_HOME/com.lectrice.reader/tts_cache"
  KEY="aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"

  echo "==> PHASE seed"
  SEED_STATUS=0
  DELETE_PHASE=seed E2E_SPEC=./e2e/delete-journey.e2e.mjs pnpm test:e2e || SEED_STATUS=$?
  echo "==> PHASE seed exit: $SEED_STATUS"

  # Observer pre-seed (app closed): metadata row + .mp3, the shape
  # repo.store writes. The doc id comes from the real seed IPC.
  DOC_ID=$(sqlite3 "$DB" "SELECT id FROM documents WHERE title='"'"'E2E Resume Fixture A'"'"' LIMIT 1;")
  printf '"'"'fake-mp3-bytes-for-delete-lane'"'"' > "$CACHE_DIR/$KEY.mp3"
  sqlite3 "$DB" "INSERT INTO tts_cache_metadata (cache_key, document_id, page_number, text_hash, voice_id, settings_hash, file_path, size_bytes, created_at, last_accessed_at, chunk_index, duration_ms) VALUES ('"'"'$KEY'"'"', '"'"'$DOC_ID'"'"', 2, '"'"'delete-lane-seed-hash'"'"', '"'"'fixture-voice'"'"', '"'"'fixture-settings'"'"', '"'"'$CACHE_DIR/$KEY.mp3'"'"', 28, datetime('"'"'now'"'"'), datetime('"'"'now'"'"'), 0, 500);"
  echo "pre-seed: doc=$DOC_ID key=$KEY file=$CACHE_DIR/$KEY.mp3"

  echo "==> PHASE delete (real UI delete; the in-app click-again confirm)"
  DELETE_STATUS=0
  DELETE_PHASE=delete E2E_SPEC=./e2e/delete-journey.e2e.mjs pnpm test:e2e || DELETE_STATUS=$?
  echo "==> PHASE delete exit: $DELETE_STATUS"

  echo "==> POST-ORACLE (observer receipt: row + metadata + file)"
  ROWS=$(sqlite3 "$DB" "SELECT count(*) FROM documents WHERE id='"'"'$DOC_ID'"'"';")
  META=$(sqlite3 "$DB" "SELECT count(*) FROM tts_cache_metadata WHERE cache_key='"'"'$KEY'"'"';")
  FILE_GONE=1; [ ! -f "$CACHE_DIR/$KEY.mp3" ] && FILE_GONE=0
  echo "post-oracle: documents_rows=$ROWS metadata_rows=$META file_gone=$FILE_GONE"
  echo "==> lane summary: seed=$SEED_STATUS delete=$DELETE_STATUS rows=$ROWS meta=$META file_gone=$FILE_GONE"

  [ "$SEED_STATUS" -eq 0 ] && [ "$DELETE_STATUS" -eq 0 ] \
    && [ "$ROWS" = "0" ] && [ "$META" = "0" ] && [ "$FILE_GONE" = "0" ]
'
