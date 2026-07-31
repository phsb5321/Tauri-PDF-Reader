SHELL := /usr/bin/env bash
.SHELLFLAGS := -Eeuo pipefail -c
.DEFAULT_GOAL := help
.NOTPARALLEL:

BASE_REF ?= origin/main
VITEST_WORKERS ?= 1
EVIDENCE := ./scripts/run-evidence.sh

.PHONY: help doctor bootstrap format-check lint typecheck test-fast test-ui \
	test-rust test quality verify build coverage smoke-reader verify-full \
	adversarial report gate clean-artifacts

help: ## Show the delivery-harness commands.
	@awk 'BEGIN { FS = ":.*## " } /^[a-zA-Z0-9_-]+:.*## / { printf "  %-18s %s\n", $$1, $$2 }' $(MAKEFILE_LIST)

doctor: ## Check worktree safety and local native-smoke prerequisites.
	$(EVIDENCE) doctor ./scripts/harness-doctor.sh

bootstrap: ## Install the exact lockfile dependencies.
	pnpm install --frozen-lockfile

format-check: ## Check Rust formatting without rewriting files.
	cd src-tauri && cargo fmt --check

lint: ## Run ESLint and architecture-boundary lint.
	pnpm lint
	pnpm lint:boundaries

typecheck: ## Run the TypeScript compiler check.
	pnpm typecheck

test-fast: ## Run only the harness's focused deterministic checks.
	./tools/test/adversarial-verdict-negative-control.sh
	pnpm exec vitest run src/lib/api/ai-tts.test.ts --maxWorkers=$(VITEST_WORKERS) --minWorkers=$(VITEST_WORKERS)
	cd src-tauri && cargo test e2e_fixture --features e2e-tts-fixture -j 1

test-ui: ## Run all frontend tests with one worker.
	pnpm exec vitest run --maxWorkers=$(VITEST_WORKERS) --minWorkers=$(VITEST_WORKERS)

test-rust: ## Run all backend tests sequentially.
	cd src-tauri && cargo test --features test-mocks -j 1

test: test-ui test-rust ## Run frontend and backend suites sequentially.

quality: ## Run deterministic alignment and its planted negative control.
	$(EVIDENCE) alignment ./tools/alignment-gate.sh --base "$(BASE_REF)"
	$(EVIDENCE) alignment-negative ./tools/test/alignment-gate-negative-control.sh

verify: doctor ## Run the normal deterministic verification floor.
	$(EVIDENCE) verify ./scripts/verify.sh
	$(MAKE) quality BASE_REF="$(BASE_REF)"

build: ## Build the frontend production bundle.
	$(EVIDENCE) frontend-build pnpm build

coverage: ## Run frontend coverage and type-coverage checks.
	$(EVIDENCE) coverage pnpm exec vitest run --coverage --maxWorkers=$(VITEST_WORKERS) --minWorkers=$(VITEST_WORKERS)
	$(EVIDENCE) type-coverage pnpm type-coverage

smoke-reader: ## Drive the real built Tauri reader through the native fixture.
	$(EVIDENCE) smoke-reader timeout --foreground 20m ./scripts/e2e-native.sh

verify-full: verify build coverage smoke-reader ## Run deterministic, build, and native-smoke evidence.

adversarial: ## Run a fresh different-family Qwen review of the committed candidate.
	$(EVIDENCE) adversarial-review ./scripts/adversarial-review.sh "$(BASE_REF)"

report: ## Generate a fail-closed evidence report for the current candidate.
	./scripts/delivery-report.sh "$(BASE_REF)"

gate: verify-full adversarial report ## Run the complete delivery gate sequentially.

clean-artifacts: ## Remove only generated local harness evidence.
	./scripts/clean-artifacts.sh
