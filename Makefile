SHELL := /usr/bin/env bash
BASE_REF ?= origin/main
GOAL ?=

.PHONY: harness-check harness-staged harness-status goal-set speckit-init

harness-check:
	@./tools/harness-policy.sh --base "$(BASE_REF)"

harness-staged:
	@./tools/harness-policy.sh --staged

harness-status:
	@./tools/harness-policy.sh --base "$(BASE_REF)" --status

goal-set:
	@test -n "$(GOAL)" || { echo 'usage: make goal-set GOAL="durable objective"' >&2; exit 2; }
	@pi goal set "$(GOAL)"

speckit-init:
	@specify init . --integration pi --force
