#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

source ./scripts/e2e-profile.sh
source ./scripts/e2e-toolchain.sh

EVIDENCE_DIR="${LECTRICE_LOCAL_TTS_EVIDENCE_DIR:-$PWD/ci-evidence/local-tts}"
mkdir -p "$EVIDENCE_DIR" "$XDG_CONFIG_HOME/lectrice"
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
control_key=0123456789abcdef0123456789abcdef
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

VITE_E2E_NATIVE=true VITE_E2E_NATIVE_TTS=local pnpm build
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
  Xvfb -displayfd 3 -screen 0 1280x1024x24 3>$DISPNUM_FILE >"'$EVIDENCE_DIR'/xvfb.log" 2>&1 &
  XVFB_PID=$!
  trap "kill $XVFB_PID 2>/dev/null || true" EXIT
  for _ in $(seq 1 100); do [ -s $DISPNUM_FILE ] && break; sleep 0.1; done
  DISPNUM=$(cat $DISPNUM_FILE)
  [ -n "$DISPNUM" ]
  export DISPLAY=:$DISPNUM
  E2E_SPEC=./e2e/local-tts.e2e.mjs pnpm test:e2e
' 2>&1 | tee "$EVIDENCE_DIR/lane.log"

jq -s '{requests: .}' "$REQUEST_LOG" >"$EVIDENCE_DIR/receipt.json"
jq -e '
  (.requests | length) >= 1 and
  (.requests | all(.[];
    (.body.input | type == "string" and length > 0) and
    (.body.voice == "F1-pt") and
    (.idempotencyKey | test("^[0-9a-f]{64}$"))))
' "$EVIDENCE_DIR/receipt.json" >/dev/null
printf 'local-tts packaged gate PASS — evidence %s\n' "$EVIDENCE_DIR/receipt.json"
