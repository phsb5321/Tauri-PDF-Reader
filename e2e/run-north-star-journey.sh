#!/usr/bin/env bash
# Spec 079 first-reader acceptance: three native app processes, one profile.
set -euo pipefail
cd "$(dirname "$0")/.."

# Heavy packaged lanes share native-driver and global display/evidence surfaces.
exec 9>/tmp/lectrice-heavy-gate.lock
flock 9

source ./scripts/e2e-profile.sh
export CI=true
source ./scripts/e2e-toolchain.sh

APP_DIR="$E2E_PROFILE_DIR/com.lectrice.reader"
RESULT_DIR="${NORTH_STAR_RESULT_DIR:-$E2E_PROFILE_DIR/north-star-result}"
mkdir -p "$APP_DIR"
rm -rf "$RESULT_DIR"
mkdir -p "$RESULT_DIR"

SOURCE_SHA="$(git rev-parse HEAD)"
[[ "$SOURCE_SHA" =~ ^[0-9a-f]{40}$ ]] || {
  echo "north-star: cannot resolve an exact source SHA" >&2
  exit 2
}
# A source-bound receipt cannot describe uncommitted product/test code.
git diff --quiet HEAD -- || {
  echo "north-star: tracked worktree changes make source_sha dishonest" >&2
  exit 2
}
git diff --cached --quiet -- || {
  echo "north-star: staged changes make source_sha dishonest" >&2
  exit 2
}

node scripts/gen-e2e-fixtures.mjs "$APP_DIR" >/dev/null
GOOD="$APP_DIR/e2e-resume-fixture-a.pdf"
FIXTURE_SHA="$(sha256sum "$GOOD" | awk '{print $1}')"
STARTED_AT="$(date -Iseconds)"
PROFILE_ID="$(basename "$E2E_PROFILE_DIR")"

export E2E_REPO_ROOT="$PWD"
export NORTH_STAR_SOURCE_SHA="$SOURCE_SHA"
export NORTH_STAR_RESULT_DIR="$RESULT_DIR"
export NORTH_STAR_FIXTURE_SHA="$FIXTURE_SHA"
export NORTH_STAR_STARTED_AT="$STARTED_AT"
export NORTH_STAR_PROFILE_ID="$PROFILE_ID"
export GOOD

echo "==> north-star source=$SOURCE_SHA profile=$PROFILE_ID fixture=$FIXTURE_SHA"

toolchain_exec '
  set -euo pipefail
  export WEBKIT_WEBDRIVER="$(command -v WebKitWebDriver)"
  export WEBKIT_DISABLE_COMPOSITING_MODE=1 WEBKIT_DISABLE_DMABUF_RENDERER=1 LIBGL_ALWAYS_SOFTWARE=1
  export GDK_BACKEND=x11

  DISPNUM_FILE="$(mktemp)"
  Xvfb -displayfd 3 -screen 0 1280x1024x24 3>"$DISPNUM_FILE" >"$NORTH_STAR_RESULT_DIR/xvfb.log" 2>&1 &
  XVFB_PID=$!
  cleanup() {
    kill "${OPENBOX_PID:-}" 2>/dev/null || true
    kill "$XVFB_PID" 2>/dev/null || true
    rm -f "$DISPNUM_FILE"
  }
  trap cleanup EXIT
  for _ in $(seq 1 100); do [ -s "$DISPNUM_FILE" ] && break; sleep 0.1; done
  [ -s "$DISPNUM_FILE" ] || {
    cat "$NORTH_STAR_RESULT_DIR/xvfb.log" >&2
    echo "north-star: Xvfb did not publish a display" >&2
    exit 1
  }
  export DISPLAY=":$(cat "$DISPNUM_FILE")"

  openbox --sm-disable >"$NORTH_STAR_RESULT_DIR/openbox.log" 2>&1 &
  OPENBOX_PID=$!
  for _ in $(seq 1 30); do
    kill -0 "$OPENBOX_PID" 2>/dev/null || {
      cat "$NORTH_STAR_RESULT_DIR/openbox.log" >&2
      echo "north-star: window manager exited" >&2
      exit 1
    }
    sleep 0.1
  done
  echo "==> Xvfb/openbox ready on DISPLAY=$DISPLAY"

  if [ -n "${CARGO_TARGET_DIR:-}" ]; then
    NORTH_STAR_APP_PATH="$(realpath -m "$CARGO_TARGET_DIR/debug/tauri-pdf-reader")"
  else
    NORTH_STAR_APP_PATH="$E2E_REPO_ROOT/src-tauri/target/debug/tauri-pdf-reader"
  fi
  export NORTH_STAR_APP_PATH
  APP_PATTERN="^$(printf "%s" "$NORTH_STAR_APP_PATH" | sed "s/[][\\.^$*+?{}()|]/\\\\&/g")"

  build_lane() {
    local tts="$1"
    echo "==> build frontend/native lane tts=$tts"
    CI=true VITE_E2E_NATIVE=true VITE_E2E_NATIVE_TTS="$tts" \
      VITE_E2E_PROFILE_DIR="$XDG_DATA_HOME/com.lectrice.reader" \
      VITE_E2E_OPEN_PATH="$GOOD" pnpm build >/dev/null
    touch src-tauri/src/lib.rs
    (cd src-tauri && cargo build --features e2e-tts-fixture >/dev/null 2>&1)
    [ -x "$NORTH_STAR_APP_PATH" ] || {
      echo "north-star: app binary missing at $NORTH_STAR_APP_PATH" >&2
      exit 1
    }
  }

  stop_non_acceptance_process() {
    # Used only after phases whose teardown is not the acceptance boundary.
    # The configured-close phase must prove its own death and is never helped.
    pkill -f "$APP_PATTERN" 2>/dev/null || true
    for _ in $(seq 1 100); do
      pgrep -f "$APP_PATTERN" >/dev/null 2>&1 || return 0
      sleep 0.1
    done
    echo "north-star: non-acceptance phase process did not terminate" >&2
    return 1
  }

  build_lane none
  echo "==> PHASE no-key-open"
  NORTH_STAR_PHASE=no-key-open \
    E2E_SPEC=./e2e/north-star-journey.e2e.mjs pnpm test:e2e
  stop_non_acceptance_process

  build_lane fixture
  echo "==> PHASE configured-close"
  NORTH_STAR_PHASE=configured-close \
    E2E_SPEC=./e2e/north-star-journey.e2e.mjs pnpm test:e2e
  if pgrep -f "$APP_PATTERN" >/dev/null 2>&1; then
    echo "north-star: configured-close left the original process alive" >&2
    exit 1
  fi

  DB="$XDG_CONFIG_HOME/com.lectrice.reader/pdf-reader.db"
  [ -f "$DB" ] || { echo "north-star: profile database is absent" >&2; exit 1; }
  DOC_COUNT="$(sqlite3 "$DB" "SELECT count(*) FROM documents;")"
  PAGE="$(sqlite3 "$DB" "SELECT current_page FROM documents ORDER BY last_opened_at DESC LIMIT 1;")"
  # char(...) avoids nesting a shell quote inside the delegated script.
  HIGHLIGHT_COUNT="$(sqlite3 "$DB" "SELECT count(*) FROM v_highlight_citations WHERE page_number=2 AND instr(text_content,char(108,101,99,116,114,105,99,101,32,102,105,120,116,117,114,101,32,112,97,103,101,32,116,119,111))>0;")"
  [ "$DOC_COUNT" -eq 1 ] || { echo "north-star: expected one opened document, observed $DOC_COUNT" >&2; exit 1; }
  [ "$PAGE" -eq 3 ] || { echo "north-star: acknowledged page did not persist (observed $PAGE)" >&2; exit 1; }
  [ "$HIGHLIGHT_COUNT" -ge 1 ] || { echo "north-star: acknowledged highlight did not persist" >&2; exit 1; }

  jq -n \
    --argjson document_count "$DOC_COUNT" \
    --argjson current_page "$PAGE" \
    --argjson highlight_count "$HIGHLIGHT_COUNT" \
    "{document_count:\$document_count,current_page:\$current_page,highlight_count:\$highlight_count}" \
    >"$NORTH_STAR_RESULT_DIR/post-close-db.json"

  echo "==> PHASE resume-verify (new process, same profile)"
  NORTH_STAR_PHASE=resume-verify \
    E2E_SPEC=./e2e/north-star-journey.e2e.mjs pnpm test:e2e
  stop_non_acceptance_process

  for phase in no-key-open configured-close resume-verify; do
    jq -e --arg phase "$phase" --arg sha "$NORTH_STAR_SOURCE_SHA" \
      ".phase == \$phase and .source_sha == \$sha and all(.steps[]; .result == \"pass\" and .failure_reason == null)" \
      "$NORTH_STAR_RESULT_DIR/$phase.json" >/dev/null
  done

  jq -n \
    --arg source_sha "$NORTH_STAR_SOURCE_SHA" \
    --arg profile_id "$NORTH_STAR_PROFILE_ID" \
    --arg fixture_sha "$NORTH_STAR_FIXTURE_SHA" \
    --slurpfile no_key "$NORTH_STAR_RESULT_DIR/no-key-open.json" \
    --slurpfile configured "$NORTH_STAR_RESULT_DIR/configured-close.json" \
    --slurpfile verify "$NORTH_STAR_RESULT_DIR/resume-verify.json" \
    --slurpfile db "$NORTH_STAR_RESULT_DIR/post-close-db.json" \
    "{
      source_sha: \$source_sha,
      profile_id: \$profile_id,
      fixture_sha256: \$fixture_sha,
      phases: [\$no_key[0], \$configured[0], \$verify[0]],
      post_close_db: \$db[0]
    }" >"$NORTH_STAR_RESULT_DIR/phase-evidence.json"
  EVIDENCE_SHA="$(sha256sum "$NORTH_STAR_RESULT_DIR/phase-evidence.json" | awk "{print \$1}")"
  FINISHED_AT="$(date -Iseconds)"

  jq -n \
    --arg source_sha "$NORTH_STAR_SOURCE_SHA" \
    --arg profile_id "$NORTH_STAR_PROFILE_ID" \
    --arg fixture_id "e2e-resume-fixture-a:$NORTH_STAR_FIXTURE_SHA" \
    --arg started_at "$NORTH_STAR_STARTED_AT" \
    --arg finished_at "$FINISHED_AT" \
    --arg evidence_sha "$EVIDENCE_SHA" \
    --slurpfile no_key "$NORTH_STAR_RESULT_DIR/no-key-open.json" \
    --slurpfile configured "$NORTH_STAR_RESULT_DIR/configured-close.json" \
    --slurpfile verify "$NORTH_STAR_RESULT_DIR/resume-verify.json" \
    "{
      source_sha: \$source_sha,
      platform_scope: \"Linux/X11/WebKitGTK packaged debug binary\",
      profile_id: \$profile_id,
      fixture_id: \$fixture_id,
      started_at: \$started_at,
      finished_at: \$finished_at,
      steps: (\$no_key[0].steps + \$configured[0].steps + \$verify[0].steps),
      artifacts: [{
        id: \"north-star-phase-evidence\",
        uri: (\"artifact://north-star/\" + \$source_sha + \"/phase-evidence.json\"),
        sha256: \$evidence_sha
      }],
      result: \"pass\"
    }" >"$NORTH_STAR_RESULT_DIR/journey.json"

  EXPECTED_STEPS="[\"fresh_profile\",\"open_pdf\",\"no_key_setup_visible\",\"start_narration\",\"mutate_acknowledged_state\",\"normal_close_process_ended\",\"relaunch_new_process\",\"resume_same_document_page\",\"highlight_present\"]"
  jq -e --arg sha "$NORTH_STAR_SOURCE_SHA" --argjson expected "$EXPECTED_STEPS" \
    ".source_sha == \$sha and .result == \"pass\" and [.steps[].name] == \$expected and all(.steps[]; .result == \"pass\")" \
    "$NORTH_STAR_RESULT_DIR/journey.json" >/dev/null

  JOURNEY_SHA="$(sha256sum "$NORTH_STAR_RESULT_DIR/journey.json" | awk "{print \$1}")"
  echo "north-star-journey: PASS source=$NORTH_STAR_SOURCE_SHA"
  echo "north-star-journey: result=$NORTH_STAR_RESULT_DIR/journey.json sha256=$JOURNEY_SHA"
'
