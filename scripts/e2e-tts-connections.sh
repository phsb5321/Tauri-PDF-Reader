#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

source ./scripts/e2e-profile.sh
source ./scripts/e2e-toolchain.sh

EVIDENCE_DIR="${LECTRICE_TTS_CONNECTIONS_EVIDENCE_DIR:-$PWD/ci-evidence/tts-connections}"
mkdir -p "$EVIDENCE_DIR" "$XDG_CONFIG_HOME/lectrice"
READY="$EVIDENCE_DIR/local-fixture.ready"
REQUEST_LOG="$EVIDENCE_DIR/local-requests.jsonl"
cat >"$XDG_CONFIG_HOME/lectrice/config.toml" <<'TOML'
[ai_tts]
provider = "local"
local_url = "http://127.0.0.1:5301"
voice_id = "F1-pt"
speed = 1.0
auto_page = false
TOML

python3 ./scripts/local-tts-fixture.py --log "$REQUEST_LOG" --ready "$READY" \
  >"$EVIDENCE_DIR/local-fixture.stdout" 2>"$EVIDENCE_DIR/local-fixture.stderr" &
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

seed="${FC_SEED:-20260825}"
export E2E_ELEVEN_KEY="sk_$(printf 'E2E%032d' "$seed")"
export E2E_GROQ_KEY="gsk_$(printf 'E2E%032d' "$seed")"
export E2E_CONNECTIONS_EVIDENCE_DIR="$EVIDENCE_DIR"

CI=true VITE_E2E_NATIVE=true VITE_E2E_NATIVE_TTS=local pnpm build
touch src-tauri/src/lib.rs

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
  ( cd src-tauri && cargo build --features e2e-tts-fixture -j 1 )
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
  E2E_SPEC=./e2e/tts-connections.e2e.mjs pnpm test:e2e
' 2>&1 | tee "$EVIDENCE_DIR/lane.log"

receipt_line=$(grep 'TTS_CONNECTIONS_RECEIPT ' "$EVIDENCE_DIR/lane.log" | tail -1)
[ -n "$receipt_line" ]
printf '%s\n' "${receipt_line#*TTS_CONNECTIONS_RECEIPT }" | jq . >"$EVIDENCE_DIR/receipt.json"
jq -e '
  .active == "local" and
  .connections == {local:"connected", elevenlabs:"connected", groq:"connected"} and
  .routes == {local:1, elevenlabs:1, groq:1} and
  (.storageContainsSecret == false) and
  (.logsContainSecret == false)
' "$EVIDENCE_DIR/receipt.json" >/dev/null
! grep -Fq "$E2E_ELEVEN_KEY" "$EVIDENCE_DIR/lane.log"
! grep -Fq "$E2E_GROQ_KEY" "$EVIDENCE_DIR/lane.log"
printf 'multi-connection packaged gate PASS — evidence %s\n' "$EVIDENCE_DIR/receipt.json"
