#!/usr/bin/env bash
#
# Fail-closed Gitleaks control — ops-parity T102.
#
# Target CLI: Gitleaks 8.30.1 (`dir` / `git`). The removed `protect`
# subcommand is not used (specs/077-ops-parity/research.md D6).
#
# Modes:
#   tools/gitleaks-scan.sh canary  — negative control: plant a synthetic
#                                    canary in a temp dir, prove `gitleaks dir`
#                                    DETECTS it as rule `elevenlabs-api-key`.
#   tools/gitleaks-scan.sh dir     — scan the working tree (fail on finding).
#   tools/gitleaks-scan.sh git     — scan full git history (fail on finding).
#   tools/gitleaks-scan.sh all     — canary, then dir, then git.
#
# Fail-closed contract (gap-matrix falsifier): a missing binary exits 1; a
# canary that goes undetected exits 1; any finding exits 1. A green exit is
# only ever "tool ran and found nothing".
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONFIG="$ROOT/.gitleaks.toml"
# Canary assembled from fragments so no literal secret-shaped bytes exist in
# the repo (the scanner must be able to scan its own control). Repeated
# characters keep entropy low: only the repo rule may claim it.
CANARY_VALUE="sk_$(printf 'A%.0s' {1..40})"

if ! command -v gitleaks >/dev/null 2>&1; then
  echo "FAIL-CLOSED: 'gitleaks' not on PATH (need 8.30.1: gitleaks dir|git)." >&2
  exit 1
fi

canary() {
  local tmp
  tmp="$(mktemp -d)"
  trap 'rm -rf "$tmp"' RETURN
  printf 'elevenlabs key: %s\n' "$CANARY_VALUE" > "$tmp/canary.txt"

  # Low-entropy by construction (repeated characters): generic-api-key cannot
  # claim it. Only the repo rule `elevenlabs-api-key` may. Findings print to
  # stderr, so capture 2>&1; `|| true` keeps the capture from failing under
  # `set -e` when gitleaks exits 1 on a finding.
  local output
  output="$(gitleaks dir "$tmp" -c "$CONFIG" --no-banner --no-color -v 2>&1 || true)"
  if printf '%s\n' "$output" | grep -q "RuleID:.*elevenlabs-api-key" &&
    printf '%s\n' "$output" | grep -q "$CANARY_VALUE"; then
    echo "canary detected as elevenlabs-api-key — control discriminates."
  else
    echo "FAIL-CLOSED: canary NOT detected — control is false-green." >&2
    exit 1
  fi
}

mode="${1:-all}"
case "$mode" in
  canary) canary ;;
  dir) gitleaks dir "$ROOT" -c "$CONFIG" --no-banner ;;
  git) gitleaks git "$ROOT" -c "$CONFIG" --no-banner ;;
  all)
    echo "== gitleaks $(gitleaks version 2>/dev/null | head -1 || echo 'version unknown') =="
    canary
    echo "== dir scan =="
    gitleaks dir "$ROOT" -c "$CONFIG" --no-banner
    echo "== git history scan =="
    gitleaks git "$ROOT" -c "$CONFIG" --no-banner
    ;;
  *)
    echo "usage: $0 {canary|dir|git|all}" >&2
    exit 2
    ;;
esac
