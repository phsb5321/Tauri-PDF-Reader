#!/usr/bin/env bash
#
# check-packaged-gate-trust-anchor.sh — thin wrapper over the trust-anchor
# static validator (tools/check-packaged-gate-trust-anchor.mjs).
#
# Exit: 0 = holds · 1 = violation · 2 = tooling/parse failure
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ANCHOR="${1:-$SCRIPT_DIR/test/fixtures/packaged-gate-trust-anchor.yml}"

node "$SCRIPT_DIR/check-packaged-gate-trust-anchor.mjs" "$ANCHOR" || exit $?
exit 0
