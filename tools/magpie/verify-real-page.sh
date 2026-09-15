#!/usr/bin/env bash
set -euo pipefail

base="${LECTRICE_TTS_BASE:-http://127.0.0.1:5301}"
book="${LECTRICE_MAGPIE_ORACLE_PDF:-/home/notroot/Documents/Books/Data Engineering/Data Engineering Design Patterns (Konieczny).pdf}"
vram_used="${LECTRICE_GPU_VRAM_USED:-/sys/class/drm/card0/device/mem_info_vram_used}"
work="$(mktemp -d "${TMPDIR:-/tmp}/lectrice-magpie-real-page.XXXXXX")"
curl_pid=
cleanup() {
  [ -z "$curl_pid" ] || kill "$curl_pid" 2>/dev/null || true
  rm -rf "$work"
}
trap cleanup EXIT

version="$(curl -fsS --max-time 3 "$base/health" | jq -er '.version')"
[[ $version == magpie-q6-vulkan-*-chunk-v1 ]] || {
  echo "expected chunked Magpie Vulkan service, got $version" >&2
  exit 1
}
curl -fsS --max-time 3 "$base/v1/capabilities" >"$work/capabilities.json"
jq -e '
  .limits.maxTextUtf8Bytes == 300 and
  .limits.queueCapacity == 1 and
  .runtime.acceleration == "gpu" and
  .runtime.backend == "Vulkan/RADV" and
  .runtime.quantization == "Q6_K"
' "$work/capabilities.json" >/dev/null

pdftotext -f 2 -l 2 "$book" "$work/page.txt"
python - "$work/page.txt" "$work/request.json" <<'PY'
import json, pathlib, sys
text = " ".join(pathlib.Path(sys.argv[1]).read_text().split())
assert len(text.encode("utf-8")) in (2232, 2233), (len(text), len(text.encode("utf-8")))
pathlib.Path(sys.argv[2]).write_text(json.dumps({
    "input": text,
    "voice": "Sofia-en",
    "speed": 1.0,
}))
PY
key="$(sha256sum "$work/request.json" | cut -d' ' -f1)"
baseline="$(cat "$vram_used")"
printf 'vramUsedBytes,gpuHandle\n' >"$work/gpu.csv"
curl -sS --max-time 180 -D "$work/headers.txt" \
  -w '%{http_code} %{time_total} %{size_download}\n' \
  -H 'Content-Type: application/json' -H "Idempotency-Key: $key" \
  --data-binary @"$work/request.json" "$base/v1/tts" \
  -o "$work/page.wav" >"$work/curl.stats" &
curl_pid=$!
while kill -0 "$curl_pid" 2>/dev/null; do
  used="$(cat "$vram_used")"
  handle=0
  for pid in $(pgrep -f '/magpie-cli say' || true); do
    if ls -l "/proc/$pid/fd" 2>/dev/null | grep -q '/dev/dri'; then
      handle=1
      break
    fi
  done
  printf '%s,%s\n' "$used" "$handle" >>"$work/gpu.csv"
  sleep 0.1
done
wait "$curl_pid"
curl_pid=

python - "$work" "$baseline" <<'PY'
import csv, hashlib, json, pathlib, sys, wave
root = pathlib.Path(sys.argv[1]); baseline = int(sys.argv[2])
status, wall, size = root.joinpath("curl.stats").read_text().split()
headers = root.joinpath("headers.txt").read_text()
assert status == "200", (status, headers)
cache_headers = [
    line.split(":", 1)[1].strip().lower()
    for line in headers.splitlines()
    if line.lower().startswith("x-cache-hit:")
]
assert cache_headers == ["false"], cache_headers
rows = list(csv.DictReader(root.joinpath("gpu.csv").open()))
peak = max(int(row["vramUsedBytes"]) for row in rows)
handles = sum(row["gpuHandle"] == "1" for row in rows)
with wave.open(str(root / "page.wav"), "rb") as wav:
    assert wav.getsampwidth() == 2 and wav.getnchannels() in (1, 2)
    seconds = wav.getnframes() / wav.getframerate()
wall = float(wall)
result = {
    "status": "PASS",
    "httpStatus": int(status),
    "cacheHit": False,
    "serviceRevision": json.loads(root.joinpath("capabilities.json").read_text())["runtime"]["modelRevision"],
    "pageUtf8Bytes": len(json.loads(root.joinpath("request.json").read_text())["input"].encode()),
    "pageTextSha256": hashlib.sha256(json.loads(root.joinpath("request.json").read_text())["input"].encode()).hexdigest(),
    "wallSeconds": wall,
    "audioSeconds": seconds,
    "standardRtf": wall / seconds,
    "vramBaselineBytes": baseline,
    "vramPeakBytes": peak,
    "vramDeltaBytes": peak - baseline,
    "gpuHandleSamples": handles,
    "downloadBytes": int(size),
}
assert seconds > 30 and result["standardRtf"] < 0.8
assert handles > 0 and peak > baseline
print(json.dumps(result, indent=2))
PY
