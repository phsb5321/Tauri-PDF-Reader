# Implementation Plan: Isolated pnpm Setup Contract

**Branch**: `179-pnpm-action-isolation` | **Spec**: [spec.md](./spec.md)

## Technical Context

The self-hosted fleet runs several GitHub runner services under one Unix account. `pnpm/action-setup` defaults to persistent `~/setup-pnpm`, so another job can replace that executable after setup. The packaged gate prevents direct workflow/fixture drift, requiring the canonical base fixtures to authorize the new `dest` field before executable workflows may adopt it.

## Approach

1. Extend the base-owned packaged execution and trust-anchor fixtures with the run/job-unique pnpm destination.
2. Keep executable workflows unchanged so the current base checker can validate this authority slice.
3. Preserve the fixture-to-workflow two-step trust model: after this merges, a separate workflow-only PR applies the authorized field and remains Pedro-gated.
4. Replace the timeout test's real blocking listener plus arbitrary yields with a Tokio listener and explicit dispatch acknowledgements before each paused-time advance.

## Verification

- Run both packaged contract checkers against their canonical fixtures.
- Run the complete packaged negative-control suite.
- Run `actionlint`, harness policy, and the timeout test 20 times.
- Require ordinary CI plus different-family review.

## Rollback

Revert this squash commit. The current executable workflows remain unchanged throughout this slice.
