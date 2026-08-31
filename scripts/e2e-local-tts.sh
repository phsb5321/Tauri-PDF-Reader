#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

BUILD_REVISION=$(git rev-parse HEAD)
[[ "$BUILD_REVISION" =~ ^[0-9a-f]{40}$ ]]
git diff --quiet HEAD -- || {
  echo "local-tts: tracked worktree changes make buildRevision dishonest" >&2
  exit 2
}
git diff --cached --quiet -- || {
  echo "local-tts: staged changes make buildRevision dishonest" >&2
  exit 2
}
[ -z "$(git status --porcelain --untracked-files=all)" ] || {
  echo "local-tts: untracked source makes buildRevision dishonest" >&2
  exit 2
}

source ./scripts/e2e-profile.sh
source ./scripts/e2e-toolchain.sh

EVIDENCE_DIR="${LECTRICE_LOCAL_TTS_EVIDENCE_DIR:-$PWD/ci-evidence/local-tts}"
export LECTRICE_LOCAL_TTS_EVIDENCE_DIR="$EVIDENCE_DIR"
mkdir -p "$EVIDENCE_DIR" "$XDG_CONFIG_HOME/lectrice" \
  "$XDG_CONFIG_HOME/gtk-3.0" "$XDG_CONFIG_HOME/gtk-4.0"
for gtk_settings in \
  "$XDG_CONFIG_HOME/gtk-3.0/settings.ini" \
  "$XDG_CONFIG_HOME/gtk-4.0/settings.ini"; do
  cat >"$gtk_settings" <<'GTK'
[Settings]
gtk-enable-animations=0
GTK
done
OBSERVED="$EVIDENCE_DIR/observed.json"
rm -f "$EVIDENCE_DIR/receipt.json" "$OBSERVED"
REQUEST_LOG="$EVIDENCE_DIR/requests.jsonl"
READY="$EVIDENCE_DIR/fixture.ready"
cat >"$XDG_CONFIG_HOME/lectrice/config.toml" <<'TOML'
[ai_tts]
provider = "local"
local_url = "http://127.0.0.1:5301"
voice_id = "F1-pt"
speed = 1.0
auto_page = false
TOML

python3 ./scripts/local-tts-fixture.py --log "$REQUEST_LOG" --ready "$READY" \
  >"$EVIDENCE_DIR/fixture.stdout" 2>"$EVIDENCE_DIR/fixture.stderr" &
FIXTURE_PID=$!
cleanup() {
  kill "$FIXTURE_PID" 2>/dev/null || true
}
trap cleanup EXIT
for _ in $(seq 1 100); do
  [ -s "$READY" ] && curl -fsS http://127.0.0.1:5301/health >/dev/null && break
  sleep 0.1
done
[ -s "$READY" ]
curl -fsS http://127.0.0.1:5301/health | jq -e '.ready == true' >/dev/null

# Direct contract negative control: same key with changed body is 409. A correct
# app key is body-bound and therefore cannot produce this malformed request.
control_key=$(printf '0%.0s' {1..32})
curl -fsS -o /dev/null -H 'Content-Type: application/json' \
  -H "Idempotency-Key: $control_key" \
  -d '{"input":"control one","voice":"F1-pt","speed":1.0}' \
  http://127.0.0.1:5301/v1/tts
status=$(curl -sS -o /dev/null -w '%{http_code}' -H 'Content-Type: application/json' \
  -H "Idempotency-Key: $control_key" \
  -d '{"input":"control two","voice":"F1-pt","speed":1.0}' \
  http://127.0.0.1:5301/v1/tts)
[ "$status" = 409 ]
: >"$REQUEST_LOG"

CI=true \
  VITE_E2E_NATIVE=true \
  VITE_E2E_NATIVE_TTS=local \
  VITE_E2E_NATIVE_PDF_URL=/e2e-prosody-fixture.pdf \
  pnpm build
touch src-tauri/src/lib.rs

# cpal/rodio needs a real output device contract; ALSA's null PCM consumes the
# decoded WAV deterministically without speakers or a privileged host device.
ALSA_CONFIG="$EVIDENCE_DIR/alsa-null.conf"
cat >"$ALSA_CONFIG" <<'ALSA'
pcm.!default {
  type null
}
ctl.!default {
  type null
}
ALSA
export ALSA_CONFIG_PATH="$ALSA_CONFIG"

toolchain_exec '
  set -euo pipefail
  ( cd src-tauri && cargo build )
  export WEBKIT_WEBDRIVER="$(command -v WebKitWebDriver)"
  export WEBKIT_DISABLE_COMPOSITING_MODE=1 WEBKIT_DISABLE_DMABUF_RENDERER=1 LIBGL_ALWAYS_SOFTWARE=1
  export GDK_BACKEND=x11
  DISPNUM_FILE=$(mktemp)
  Xvfb -displayfd 3 -screen 0 1920x1080x24 3>$DISPNUM_FILE >"'$EVIDENCE_DIR'/xvfb.log" 2>&1 &
  XVFB_PID=$!
  trap "kill $XVFB_PID 2>/dev/null || true" EXIT
  for _ in $(seq 1 100); do [ -s $DISPNUM_FILE ] && break; sleep 0.1; done
  DISPNUM=$(cat $DISPNUM_FILE)
  [ -n "$DISPNUM" ]
  export DISPLAY=:$DISPNUM
  E2E_SPEC=./e2e/local-tts.e2e.mjs pnpm test:e2e
' 2>&1 | tee "$EVIDENCE_DIR/lane.log"

test -s "$OBSERVED"
# The raw fixture ledger needs the idempotency value only during the live
# contract assertion above. It is not a credential, but a random-looking
# 64-hex value is indistinguishable from one to secret scanners and adds no
# durable diagnostic value. Preserve the validated boolean, not opaque bytes.
sanitized=$(mktemp)
jq -c '{body, idempotencyKeyValid: (.idempotencyKey | test("^[0-9a-f]{64}$"))}' \
  "$REQUEST_LOG" >"$sanitized"
mv "$sanitized" "$REQUEST_LOG"

BINARY_SHA256=$(sha256sum "$E2E_APP_PATH" | cut -d' ' -f1)
FIXTURE_SHA256=$(sha256sum public/e2e-prosody-fixture.pdf | cut -d' ' -f1)
jq -s \
  --slurpfile observed "$OBSERVED" \
  --arg buildRevision "$BUILD_REVISION" \
  --arg binarySha256 "$BINARY_SHA256" \
  --arg fixtureSha256 "$FIXTURE_SHA256" \
  --arg observedAt "$(date -Iseconds)" \
  '{
    status: "PASS",
    buildRevision: $buildRevision,
    binarySha256: $binarySha256,
    fixtureSha256: $fixtureSha256,
    observedAt: $observedAt,
    journey: "all Narration tabs -> Continuous + English normalization -> public Play -> Pause -> excerpt Read from here -> Stop -> paragraph margin action -> Stop -> manual next page -> immediate fresh Play -> Stop -> measured RTF",
    assertions: $observed[0],
    requests: .
  }' "$REQUEST_LOG" >"$EVIDENCE_DIR/receipt.json"
jq -e '
  .status == "PASS" and
  .assertions.highlightedSourceRange == "What" and
  .assertions.performanceProfile == "continuous" and
  .assertions.uncachedRtfVisible == true and
  .assertions.readFromHereReplacedPausedQueue == true and
  .assertions.paragraphActionStartedAtChosenParagraph == true and
  .assertions.paragraphActionNonOverlapping == true and
  .assertions.paragraphActionFocusVisible == true and
  .assertions.paragraphActionPaperMarker == true and
  .assertions.manualPageFreshPlay == "Second page ready." and
  .assertions.provider == "local" and
  .assertions.credentialPresent == false and
  .assertions.finalPlaybackState == "idle" and
  .assertions.reducedMotion.mediaMatches == true and
  .assertions.reducedMotion.maxDurationSeconds <= 0.00001 and
  (.assertions.cockpitGeometry | length) == 4 and
  (.assertions.cockpitGeometry | all(.[];
    .retainedPageRatio >= 0.6 and
    (.controls | all(.[]; .width >= 44 and .height >= 44)))) and
  (.requests | length) >= 4 and
  .requests[0].body.input == "What This Book Is About." and
  .requests[1].body.input == "This book aims to fill a gap. It connects the dots. Readers benefit." and
  (.requests[2].body.input | startswith("This book aims")) and
  (.requests | any(.[]; .body.input | startswith("Second page ready."))) and
  (.requests | all(.[];
    (.body.voice == "F1-pt") and
    .idempotencyKeyValid))
' "$EVIDENCE_DIR/receipt.json" >/dev/null
printf 'local-tts packaged gate PASS — evidence %s\n' "$EVIDENCE_DIR/receipt.json"
