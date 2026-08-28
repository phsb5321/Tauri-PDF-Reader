#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "$0")/../.." && pwd)"
unit=lectrice-magpie-desktop.service

# One explicit local route owns the pinned loopback port. This is not runtime
# fallback: a failed Magpie start leaves the health gate red.
systemctl --user stop supertonic3-tts-desktop.service "$unit" 2>/dev/null || true
systemctl --user reset-failed "$unit" 2>/dev/null || true
systemd-run --user --unit="$unit" \
  --property=Description='Lectrice Magpie Q6 Vulkan desktop TTS' \
  --property=Restart=on-failure \
  --property=RestartSec=2 \
  --property=TimeoutStartSec=180 \
  --working-directory="$root" \
  --setenv=LECTRICE_MAGPIE_PORT=5301 \
  --setenv=PYTHONUNBUFFERED=1 \
  "$root/tools/magpie/lectrice_magpie_bridge.py"

for _ in $(seq 1 720); do
  state="$(systemctl --user show "$unit" -p ActiveState --value)"
  if [[ $state == failed || $state == inactive ]]; then
    journalctl --user -u "$unit" -n 120 --no-pager >&2
    exit 1
  fi
  if revision="$(curl -q -fsS --max-time 2 http://127.0.0.1:5301/health | jq -er '.version')"; then
    [[ $revision == magpie-q6-vulkan-*-chunk-v1 ]] || exit 1
    exit 0
  fi
  sleep 0.25
done

journalctl --user -u "$unit" -n 120 --no-pager >&2
exit 1
