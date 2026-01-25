#!/usr/bin/env bash

# Verification script for Tauri PDF Reader
# Runs all checks that would run in CI/pre-commit

set -e

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
# Frontend Checks
# ============================================================================

echo -e "${BLUE}── Frontend Checks ──${NC}"
echo ""

step "Installing dependencies..."
pnpm install --frozen-lockfile || pnpm install
success "Dependencies installed"

step "TypeScript type checking..."
pnpm typecheck || error "TypeScript check failed"
success "TypeScript check passed"

step "ESLint..."
pnpm lint || error "ESLint failed"
success "ESLint passed"

step "ESLint Boundaries..."
pnpm lint:boundaries || error "ESLint boundaries check failed"
success "ESLint boundaries passed"

step "Running frontend tests..."
pnpm test:run || error "Frontend tests failed"
success "Frontend tests passed"

step "Architecture tests..."
pnpm test:arch || error "Architecture tests failed"
success "Architecture tests passed"

# ============================================================================
# Backend Checks
# ============================================================================

echo -e "${BLUE}── Backend Checks ──${NC}"
echo ""

step "Rust formatting check..."
cd src-tauri
cargo fmt --check || error "Rust formatting check failed"
success "Rust formatting passed"

step "Clippy linting..."
if command -v cargo-clippy &> /dev/null || cargo clippy --version &> /dev/null; then
    cargo clippy -- -D warnings || error "Clippy failed"
    success "Clippy passed"
else
    echo -e "${YELLOW}⚠ Clippy not installed, skipping (install with: rustup component add clippy)${NC}"
    echo ""
fi

step "Running Rust tests..."
cargo test --features test-mocks || error "Rust tests failed"
success "Rust tests passed"

step "Running contract tests..."
cargo test --features test-mocks --test '*' || error "Contract tests failed"
success "Contract tests passed"

cd ..

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
if [ $DURATION -lt 120 ]; then
    echo -e "${GREEN}✓ Verification completed in under 2 minutes${NC}"
else
    echo -e "${YELLOW}⚠ Verification took longer than 2 minutes${NC}"
fi
