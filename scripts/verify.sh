#!/usr/bin/env bash

# Verification script for Tauri PDF Reader
# Runs all checks that would run in CI/pre-commit

set -Eeuo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Track timing
START_TIME=$(date +%s)

echo -e "${BLUE}======================================${NC}"
echo -e "${BLUE}  Tauri PDF Reader - Full Verification${NC}"
echo -e "${BLUE}======================================${NC}"
echo ""

# Function to print step header
step() {
    echo -e "${YELLOW}▶ $1${NC}"
}

# Function to print success
success() {
    echo -e "${GREEN}✓ $1${NC}"
    echo ""
}

# Function to print error
error() {
    echo -e "${RED}✗ $1${NC}"
    exit 1
}

# ============================================================================
# M2.4 — machine-readable receipt: what ran, against which commit, and what
# each gate said. Written on BOTH success and failure (a receipt that only
# exists after a green run cannot record failure). The trap guarantees the
# write; VERIFY_RECEIPT_PATH redirects it (tests/CI variants); VERIFY_GATES
# replaces the gate list (test/CI seam — it never weakens a gate, it swaps
# the whole list).
# ============================================================================

VERIFY_RECEIPT_PATH="${VERIFY_RECEIPT_PATH:-verify-receipt.json}"
COMMIT_SHA="$(git rev-parse HEAD 2>/dev/null || echo unknown)"
VERIFY_STARTED="$(date -Iseconds)"
declare -a RECEIPT_GATES=()
FAILED_GATE=""

receipt_write() {
    local status="$1"
    local failed="${2:-}"
    {
        printf '{\n'
        printf '  "status": "%s",\n' "$status"
        if [ -n "$failed" ]; then
            printf '  "failedGate": "%s",\n' "$failed"
        fi
        printf '  "commit": "%s",\n' "$COMMIT_SHA"
        printf '  "timestamp": "%s",\n' "$VERIFY_STARTED"
        printf '  "gates": [\n'
        local i=0
        for g in "${RECEIPT_GATES[@]}"; do
            if [ "$i" -gt 0 ]; then printf ',\n'; fi
            printf '    %s' "$g"
            i=$((i + 1))
        done
        printf '\n  ]\n}\n'
    } > "$VERIFY_RECEIPT_PATH"
}

receipt_finalize() {
    if [ -n "$FAILED_GATE" ]; then
        receipt_write failed "$FAILED_GATE"
    else
        receipt_write passed
    fi
}
trap receipt_finalize EXIT

# Run one gate: record name+outcome in the receipt; on failure, name the gate
# and exit 1 (the trap writes the receipt).
run_gate() {
    local name="$1"
    shift
    step "$name"
    if "$@" >/dev/null 2>&1; then
        RECEIPT_GATES+=("{\"gate\":\"$name\",\"status\":\"pass\"}")
        success "$name"
    else
        RECEIPT_GATES+=("{\"gate\":\"$name\",\"status\":\"fail\"}")
        FAILED_GATE="$name"
        error "$name failed"
    fi
}

# ============================================================================
# Frontend Checks
# ============================================================================

if [ -n "${VERIFY_GATES:-}" ]; then
    # Override (test/CI seam): each line is "name|command".
    while IFS='|' read -r gate_name gate_cmd; do
        [ -n "$gate_name" ] || continue
        run_gate "$gate_name" bash -c "$gate_cmd"
    done <<< "$VERIFY_GATES"
    exit 0
fi

echo -e "${BLUE}── Frontend Checks ──${NC}"
echo ""

run_gate "dependencies" pnpm install --frozen-lockfile

run_gate "typecheck" pnpm typecheck

run_gate "lint" pnpm lint

run_gate "lint-boundaries" pnpm lint:boundaries

run_gate "frontend-tests" pnpm exec vitest run --maxWorkers=1 --minWorkers=1

run_gate "architecture-tests" pnpm exec vitest run src/__tests__/architecture/ --maxWorkers=1 --minWorkers=1

# ============================================================================
# Backend Checks
# ============================================================================

echo -e "${BLUE}── Backend Checks ──${NC}"
echo ""

# `tauri::generate_context!()` in src-tauri/src/lib.rs reads tauri.conf.json's
# frontendDist ("../dist") at macro-expansion time, so every cargo step below
# fails to compile in a tree that has never run `pnpm build`. CI stubs it rather
# than building (ci.yml, "Stub frontend dist"); match that. A real dist is left
# alone.
if [ ! -f dist/index.html ]; then
    step "Stubbing frontend dist (tauri generate_context! reads frontendDist)..."
    mkdir -p dist
    echo '<!doctype html><meta charset="utf-8"><title>Lectrice</title>' > dist/index.html
    success "Stub dist written"
fi

run_gate "rust-format" bash -c "cd src-tauri && cargo fmt --check"

step "Clippy linting..."
if command -v cargo-clippy &> /dev/null || cargo clippy --version &> /dev/null; then
    # Lint scope is deliberately identical to ci.yml's "Clippy" step (bare, no
    # --all-targets, no features). `-j 1` is a resource flag only; it does not
    # change what is linted. Widening this here would make the script red where
    # CI is green, which defeats the header's "checks that would run in CI".
    # CI itself never lints the example or the six integration-test targets --
    # that gap is real, but closing it edits .github/workflows, so it is filed
    # in docs/agent-backlog-state.md rather than fixed here.
    if (cd src-tauri && cargo clippy -j 1 -- -D warnings) >/dev/null 2>&1; then
        RECEIPT_GATES+=("{\"gate\":\"clippy\",\"status\":\"pass\"}")
        success "clippy"
    else
        RECEIPT_GATES+=("{\"gate\":\"clippy\",\"status\":\"fail\"}")
        FAILED_GATE="clippy"
        error "clippy failed"
    fi
else
    echo -e "${YELLOW}⚠ Clippy not installed, skipping (install with: rustup component add clippy)${NC}"
    echo ""
fi

run_gate "rust-tests" bash -c "cd src-tauri && cargo test --features test-mocks -j 1"

run_gate "contract-tests" bash -c "cd src-tauri && cargo test --features test-mocks --test '*' -j 1"

# ============================================================================
# Summary
# ============================================================================

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

echo -e "${BLUE}======================================${NC}"
echo -e "${GREEN}  All checks passed!${NC}"
echo -e "${BLUE}======================================${NC}"
echo ""
echo -e "Total time: ${DURATION}s"
echo ""

# Check if duration is under target
if [ "$DURATION" -lt 120 ]; then
    echo -e "${GREEN}✓ Verification completed in under 2 minutes${NC}"
else
    echo -e "${YELLOW}⚠ Verification took longer than 2 minutes${NC}"
fi
