# Implementation Plan: Goal and Spec Kit Enforcement

**Branch**: `080-goal-speckit-enforcement` | **Date**: 20/08/2026
**Spec**: `specs/080-goal-speckit-enforcement/spec.md`

## Technical Context

Lectrice already has Husky, package scripts, `scripts/verify.sh`, and `tools/alignment-gate.sh`. Pi already has a host-level continuation extension and durable `pi goal`; the missing piece is a repository-owned executable policy that every boundary can call. The policy remains POSIX-friendly Bash plus Git and does not add a dependency.

## Constitution Check

- Build the verifier rather than asking a model for a verdict.
- Preserve the targeted-fix exemption; broad product work gets the full chain.
- Use the branch name to bind work to its own artifacts.
- Fail closed on missing evidence and leave an explicit recovery command.
- Keep one policy implementation and thin adapters; do not duplicate decisions across hooks.

## Design

1. `tools/harness-policy.sh` computes the union of committed branch changes and working changes against a declared base. In Pi processes it also checks the durable seat goal.
2. Product-touching changes at or above three files require non-template `spec.md`, `plan.md`, and `tasks.md` in `specs/<feature-branch>/`.
3. `Makefile`, package scripts, Husky, `scripts/verify.sh`, and `tools/alignment-gate.sh` delegate to that script.
4. A hermetic negative control creates a temporary Git repository and proves reject/reject/allow behavior.
5. The host Pi extension receives a project policy that calls this same command at settlement and adds bounded goal settlement refusal.

## Verification

- `bash tools/test/harness-policy-negative-control.sh`
- `make harness-check`
- `pnpm harness:check`
- `bash -n tools/harness-policy.sh tools/test/harness-policy-negative-control.sh .husky/pre-commit`
- `pnpm typecheck`
- `./tools/alignment-gate.sh --base origin/main`
