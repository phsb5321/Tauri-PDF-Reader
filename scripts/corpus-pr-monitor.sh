#!/usr/bin/env bash
#
# corpus-pr-monitor.sh — lightweight background poll of the corpus prerequisite
# PR heads. Logs head/state changes to /tmp/lectrice-corpus-pr-heads.log so the
# product pane (or a future session) can rebase immediately when a gate moves.
# Read-only: gh api queries only, no repo mutation.
#
# Usage:   nohup bash scripts/corpus-pr-monitor.sh > /tmp/lectrice-corpus-pr-monitor.out 2>&1 &
# Kill:    pkill -f corpus-pr-monitor.sh

set -uo pipefail
LOG=/tmp/lectrice-corpus-pr-heads.log
INTERVAL=180          # 3 min
STATE=/tmp/lectrice-corpus-pr-heads.state
: > "$LOG"
: > "$STATE"
echo "$(date '+%d/%m/%Y %H:%M:%S %Z') monitor start (interval ${INTERVAL}s)" >> "$LOG"

while true; do
  LINE="$(date '+%H:%M:%S') $(gh pr list --state open --json number,headRefName,headRefOid 2>/dev/null \
    | jq -c '[.[] | select(.number == 119 or .number == 122 or .number == 123)] | sort_by(.number)')"
  PREV="$(cat "$STATE" 2>/dev/null || echo)"
  if [ "$LINE" != "$PREV" ]; then
    echo "$LINE" >> "$LOG"
    echo "$LINE" > "$STATE"
  fi
  sleep "$INTERVAL"
done
