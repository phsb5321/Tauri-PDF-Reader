#!/usr/bin/env bash
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
work="$(mktemp -d "${TMPDIR:-/tmp}/lectrice-magpie-bridge.XXXXXX")"
pid=
cleanup() {
  [ -z "$pid" ] || kill "$pid" 2>/dev/null || true
  [ -z "$pid" ] || wait "$pid" 2>/dev/null || true
  rm -rf "$work"
}
trap cleanup EXIT

python "$here/test_lectrice_magpie_bridge.py"
printf 'fake model\n' >"$work/model.gguf"
port="$(python - <<'PY'
import socket
with socket.socket() as sock:
    sock.bind(('127.0.0.1', 0))
    print(sock.getsockname()[1])
PY
)"
LECTRICE_MAGPIE_FAKE_TRACE="$work/trace.jsonl" \
  python "$here/fake_bridge_server.py" \
    --port "$port" \
    --cli "$here/fake_magpie_cli.py" \
    --model "$work/model.gguf" \
    >"$work/bridge.log" 2>&1 &
pid=$!
for _ in $(seq 1 100); do
  curl -fsS --max-time 1 "http://127.0.0.1:$port/health" >/dev/null 2>&1 && break
  kill -0 "$pid" 2>/dev/null || { cat "$work/bridge.log" >&2; exit 1; }
  sleep 0.05
done

curl -fsS "http://127.0.0.1:$port/v1/capabilities" >"$work/capabilities.json"
jq -e '
  .ready == true and
  .limits.maxTextUtf8Bytes == 300 and
  .limits.queueCapacity == 1 and
  .runtime.acceleration == "gpu" and
  .runtime.backend == "Vulkan/RADV" and
  .runtime.device == "Fixture Vulkan Device"
' "$work/capabilities.json" >/dev/null
python - "$work/request.json" <<'PY'
import json, pathlib, sys
sentence = "Data systems need semantic boundaries, deterministic queues, and exact source order. "
text = (sentence * 40)[:2233]
assert len(text) == 2233
pathlib.Path(sys.argv[1]).write_text(json.dumps({"input": text, "voice": "Sofia-en", "speed": 1.0}))
PY
key="$(sha256sum "$work/request.json" | cut -d' ' -f1)"
curl -fsS --max-time 15 -D "$work/first.headers" \
  -H 'Content-Type: application/json' -H "Idempotency-Key: $key" \
  --data-binary @"$work/request.json" "http://127.0.0.1:$port/v1/tts" \
  -o "$work/page.wav"
grep -qi '^X-Cache-Hit: false' "$work/first.headers"
python "$here/verify_bridge.py" "$work"

curl -fsS --max-time 3 -D "$work/replay.headers" \
  -H 'Content-Type: application/json' -H "Idempotency-Key: $key" \
  --data-binary @"$work/request.json" "http://127.0.0.1:$port/v1/tts" \
  -o "$work/replay.wav"
grep -qi '^X-Cache-Hit: true' "$work/replay.headers"
cmp "$work/page.wav" "$work/replay.wav"

jq '.input += " changed"' "$work/request.json" >"$work/changed.json"
status="$(curl -sS --max-time 3 -o "$work/conflict.json" -w '%{http_code}' \
  -H 'Content-Type: application/json' -H "Idempotency-Key: $key" \
  --data-binary @"$work/changed.json" "http://127.0.0.1:$port/v1/tts")"
[ "$status" = 409 ]
jq -e '.code == "idempotency_key_reused"' "$work/conflict.json" >/dev/null

echo 'verify-bridge: PASS'
