#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

source ./scripts/e2e-profile.sh
source ./scripts/e2e-toolchain.sh

EVIDENCE_DIR="${LECTRICE_MAGPIE_EVIDENCE_DIR:-$PWD/ci-evidence/magpie-real}"
FIXTURE="$PWD/public/e2e-magpie-performance.pdf"
mkdir -p "$EVIDENCE_DIR" "$XDG_CONFIG_HOME/lectrice"
cleanup() {
  [ -z "${SAMPLE_PID:-}" ] || kill "$SAMPLE_PID" 2>/dev/null || true
  rm -f "$FIXTURE"
}
trap cleanup EXIT

revision="$(curl -fsS --max-time 3 http://127.0.0.1:5301/health | jq -er '.version')"
[[ $revision == magpie-q6-vulkan-*-chunk-v1 ]]
curl -fsS --max-time 3 http://127.0.0.1:5301/v1/capabilities >"$EVIDENCE_DIR/capabilities.json"
jq -e '
  .runtime.model == "Magpie TTS Multilingual 357M" and
  .runtime.quantization == "Q6_K" and
  .runtime.backend == "Vulkan/RADV" and
  .runtime.acceleration == "gpu" and
  .limits.maxTextUtf8Bytes == 300 and
  .limits.queueCapacity == 1
' "$EVIDENCE_DIR/capabilities.json" >/dev/null

node ./scripts/gen-e2e-magpie-fixture.mjs "$FIXTURE"
cat >"$XDG_CONFIG_HOME/lectrice/config.toml" <<'TOML'
[ai_tts]
provider = "local"
local_url = "http://127.0.0.1:5301"
voice_id = "Sofia-en"
speed = 1.0
auto_page = true
TOML

CI=true \
  VITE_E2E_NATIVE=true \
  VITE_E2E_NATIVE_TTS=local \
  VITE_E2E_NATIVE_PDF_URL=/e2e-magpie-performance.pdf \
  pnpm build
touch src-tauri/src/lib.rs

cat >"$EVIDENCE_DIR/alsa-null.conf" <<'ALSA'
pcm.!default {
  type null
}
ctl.!default {
  type null
}
ALSA
export ALSA_CONFIG_PATH="$EVIDENCE_DIR/alsa-null.conf"

VRAM_USED="${LECTRICE_GPU_VRAM_USED:-/sys/class/drm/card0/device/mem_info_vram_used}"
BASELINE="$(cat "$VRAM_USED")"
printf 'vramUsedBytes,gpuHandle\n' >"$EVIDENCE_DIR/gpu.csv"
(
  while :; do
    used="$(cat "$VRAM_USED")"
    handle=0
    for pid in $(pgrep -f '/magpie-cli say' || true); do
      if ls -l "/proc/$pid/fd" 2>/dev/null | grep -q '/dev/dri'; then
        handle=1
        break
      fi
    done
    printf '%s,%s\n' "$used" "$handle" >>"$EVIDENCE_DIR/gpu.csv"
    sleep 0.1
  done
) &
SAMPLE_PID=$!
STARTED="$(date -Iseconds)"

set +e
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
  export DISPLAY=:$(cat $DISPNUM_FILE)
  E2E_SPEC=./e2e/magpie-real-page.e2e.mjs pnpm test:e2e
' 2>&1 | tee "$EVIDENCE_DIR/lane.log"
LANE_RC=${PIPESTATUS[0]}
set -e
kill "$SAMPLE_PID" 2>/dev/null || true
wait "$SAMPLE_PID" 2>/dev/null || true
SAMPLE_PID=

journalctl --user -u lectrice-magpie-desktop.service --since "$STARTED" --no-pager -o cat \
  | grep -E 'synthesized voice=|GGML_ASSERT|engine_failed' >"$EVIDENCE_DIR/bridge.log" || true
[ "$LANE_RC" -eq 0 ]

BUILD_REVISION="$(git rev-parse HEAD)"
BINARY_SHA256="$(sha256sum "$E2E_APP_PATH" | cut -d' ' -f1)"
FIXTURE_SHA256="$(sha256sum "$FIXTURE" | cut -d' ' -f1)"
python - "$EVIDENCE_DIR" "$BASELINE" "$BUILD_REVISION" "$BINARY_SHA256" "$FIXTURE_SHA256" "$STARTED" <<'PY'
import csv, hashlib, json, pathlib, re, sys
root=pathlib.Path(sys.argv[1]); baseline=int(sys.argv[2])
build,binary,fixture,started=sys.argv[3:7]
cap=json.loads((root/'capabilities.json').read_text())
log=(root/'bridge.log').read_text()
assert 'GGML_ASSERT' not in log and 'engine_failed' not in log
rows=[]
for line in log.splitlines():
    if 'synthesized voice=Sofia-en' not in line: continue
    chunks=int(re.search(r'chunks=(\d+)',line).group(1))
    sizes=[int(value) for value in re.search(r'chunk_bytes=\[([^]]+)\]',line).group(1).split(',')]
    rows.append({'chunks':chunks,'chunkBytes':sizes})
assert len(rows)>=3, rows
assert all(row['chunks']==1 and len(row['chunkBytes'])==1 and 0<row['chunkBytes'][0]<=300 for row in rows)
gpu=list(csv.DictReader((root/'gpu.csv').open()))
peak=max(int(row['vramUsedBytes']) for row in gpu)
handles=sum(row['gpuHandle']=='1' for row in gpu)
receipt={
  'status':'PASS','buildRevision':build,'binarySha256':binary,
  'fixtureSha256':fixture,'observedAt':started,
  'serviceRevision':cap['runtime']['modelRevision'],'runtime':cap['runtime'],
  'journey':'Performance -> Continuous -> public Play -> exact highlight -> natural page advance -> public Stop',
  'assertions':{
    'profile':'continuous','firstHighlightedSource':'Reliable','pageAdvancedFrom':1,
    'pageAdvancedTo':2,'advanceCount':1,'finalPlaybackState':'idle',
    'allRequestsAtMost300Bytes':True,'everyBridgeCallOneChunk':True,
    'gpuDeviceOpened':handles>0,'vramIncreased':peak>baseline,
    'credentialPresent':False,'ggmlAssertion':False,
  },
  'requestTrace':rows,'vramBaselineBytes':baseline,'vramPeakBytes':peak,
  'vramDeltaBytes':peak-baseline,'gpuHandleSamples':handles,
}
assert receipt['assertions']['gpuDeviceOpened'] and receipt['assertions']['vramIncreased']
(root/'receipt.json').write_text(json.dumps(receipt,indent=2)+'\n')
print(json.dumps({'status':'PASS','requests':len(rows),'vramDeltaBytes':peak-baseline,'gpuHandleSamples':handles}))
PY

echo "magpie packaged gate PASS — evidence $EVIDENCE_DIR/receipt.json"
