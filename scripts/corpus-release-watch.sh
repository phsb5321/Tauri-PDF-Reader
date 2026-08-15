#!/usr/bin/env bash
#
# corpus-release-watch.sh — BOUNDED release-product poll loop (20 minutes).
# Monitors issue #120 state, the prerequisite PRs, and origin/main; logs any
# change; exits after the time budget. Read-only (gh api + git fetch only).
#
# Usage:   setsid nohup bash scripts/corpus-release-watch.sh > /tmp/lectrice-corpus-release-watch.out 2>&1 < /dev/null &
# Kill:    kill "$(cat /tmp/lectrice-corpus-release-watch.pid)"
# Budget:  WATCH_MINUTES env (default 20)

set -uo pipefail
WORKTREE="$(cd "$(dirname "$0")/.." && pwd)"
LOG=/tmp/lectrice-corpus-release-watch.log
PIDFILE=/tmp/lectrice-corpus-release-watch.pid
INTERVAL=60
BUDGET_MIN="${WATCH_MINUTES:-20}"
BUDGET_SEC=$((BUDGET_MIN * 60))

echo "$$" > "$PIDFILE"
trap 'rm -f "$PIDFILE"' EXIT
log() { echo "$(date '+%d/%m/%Y %H:%M:%S %Z') $*" >> "$LOG"; }

: > "$LOG"
log "release-watch start (budget ${BUDGET_MIN}min, interval ${INTERVAL}s)"

LAST_MAIN=""
LAST_ISSUE=""
LAST_PRS=""
END=$(( $(date +%s) + BUDGET_SEC ))

while [ "$(date +%s)" -lt "$END" ]; do
  cd "$WORKTREE" 2>/dev/null || { log "FATAL: worktree missing"; exit 1; }

  git fetch origin main -q 2>>"$LOG"
  MAIN="$(git rev-parse origin/main 2>/dev/null)"
  ISSUE="$(gh issue view 120 --json state,updatedAt,body 2>/dev/null | jq -c '{s:.state,u:.updatedAt,h:(.body|length)}')"
  PRS="$(gh pr list --state open --json number,headRefOid 2>/dev/null \
    | jq -c '[.[] | select(.number == 119 or .number == 122 or .number == 123)] | sort_by(.number)')"

  if [ -n "$LAST_MAIN" ] && [ "$MAIN" != "$LAST_MAIN" ]; then log "main moved: $LAST_MAIN -> $MAIN"; fi
  if [ -n "$LAST_ISSUE" ] && [ "$ISSUE" != "$LAST_ISSUE" ]; then log "issue #120 changed: $ISSUE"; fi
  if [ -n "$LAST_PRS" ] && [ "$PRS" != "$LAST_PRS" ]; then log "PR heads changed: $PRS"; fi

  LAST_MAIN="$MAIN"; LAST_ISSUE="$ISSUE"; LAST_PRS="$PRS"
  sleep "$INTERVAL"
done

log "release-watch budget exhausted (${BUDGET_MIN}min) — exiting as designed"
