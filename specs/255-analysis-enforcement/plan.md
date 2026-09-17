# Implementation Plan: Analysis enforcement — truthful coverage results

**Branch**: `255-analysis-enforcement` | **Date**: 15/09/2026 | **Spec**: [spec.md](spec.md)

**Input**: `specs/255-analysis-enforcement/spec.md`

## Summary

Remove the strict coverage command's success-producing warning fallback, exercise the actual command with controlled analyzer outcomes, and invoke the same regression from the existing verification-receipt test suite. Reuse the existing shell, Node standard library and Vitest; no application or workflow changes.

**Hypothesis**: the strict coverage entrypoint falsely succeeds because `|| echo` replaces the failed analyzer's exit status with echo's successful exit. The authorized final red/green comparison reproduced this for failure17 and missing-command127.

Original base5e710cf36e5c9e0e027c95b95dc7fa809b2349d3; current inherited base35801daa8657a8c0b72c3b06a04c994b6a46bc8c after PR206. Fast-forward had zero tracked-WIP overlap and preserved all three reviewed code hashes and incoming249 helpers.

## Technical Context

**Language/Version**: existing Bash command; JavaScript ESM and Node22.23.2 in the desktop slot; existing TypeScript5.6/Vitest2.1.9 wrapper. CI's configured Node20 remains a separate execution surface to verify.

**Primary Dependencies**: Node built-ins `node:test`, `node:assert/strict`, `node:child_process`, filesystem/path/URL helpers; existing Vitest. No added dependency.

**Storage**: no application storage. Each test owns one newly created temporary directory for argument capture. Durable command/slot evidence is stored under the existing fleet-coordination state directory.

**Testing**: three-case stdlib regression plus the existing four-case verification-receipt suite, scoped TS ESLint, typecheck, branch-bound harness check, normal hooks and required protected CI.

**Target Platform**: Linux desktop's authorized slot and existing Linux CI with Bash available. No application launch or native backend execution is part of this regression.

**Project Type**: verification tooling in the existing Tauri desktop repository.

**Performance Goals**: each child is bounded to5s; standalone red/green slot budget30s. Final pair measured4.267s including reader stop/restoration. Ordinary qualification measured18.350s; these are observations, not universal timing guarantees.

**Constraints**: sole execution-slot owner251; reader225 restored unchanged; no concurrent product checks, real coverage run, provider call, credential propagation, new dependency, first-party exclusion, threshold change, workflow edit or source-repair budget reset. Existing2/2 source-repair budget is exhausted.

**Scale/Scope**: one package script, one stdlib regression and one new case in an existing integration-test file. Documentation completes the already-implemented scope; it does not add product behavior.

## Constitution Check

| Principle                             | Design and verification                                                                                                                                                                           |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I — Hexagonal architecture            | No application/domain/adapter dependency changes. The integration test remains test infrastructure.                                                                                               |
| II — Typed IPC ratchet                | No IPC, generated bindings or exception-list change.                                                                                                                                              |
| III — Test-first and coverage ratchet | Preserved all existing tests, analyzer flags,100% strict-command threshold and current CI floors. Same regression rejects old source and accepts the candidate. No denominator or scope change.   |
| IV — Design system                    | No UI/style changes.                                                                                                                                                                              |
| V — State management                  | No stores, logging or runtime transitions changed.                                                                                                                                                |
| VI — Verification discipline          | Real shell exit propagation asserted; abnormal exits rejected; source/slot/restoration receipts retained. Synthetic results do not claim actual source coverage or user-visible AI functionality. |
| Governance/resource rules             | Completed branch-bound spec/plan/tasks; only251 executes product checks. Hooks/CI/merge are separate unmet gates, not bypassed by local success.                                                  |

No constitution exception is requested. The campaign's higher score objective is not a silent rewrite of current enforced floors.

## Project Structure

```text
package.json
  test:coverage:check — remove only the warning fallback

tools/test/analysis-enforcement.test.mjs
  actual-command subprocess regression; success0/failure17/missing127 outcomes

src/__tests__/integration/verify-receipt.test.ts
  existing three receipt cases plus wrapper invoking the same stdlib checker

specs/255-analysis-enforcement/
  spec.md, plan.md, tasks.md

reports/
  DELIVERY.md, source-review.md, source-manifest.json
```

**Structure Decision**: reuse ordinary Vitest discovery rather than create a separate CI workflow. `scripts/verify.sh` is untouched: fresh main already runs mandatory `cargo-clippy` and `cargo-fmt`.

## Implementation and Verification Sequence

1. Read the vault's consolidated stack/runbook and actual source/history/API state. Keep current metrics, target metrics and integration gaps distinct in `reports/DELIVERY.md`.
2. Change only `package.json`'s strict coverage script from the command with `|| echo` to `vitest run --coverage --coverage.thresholds.100`.
3. Read that actual script in the stdlib test. Define a controlled shell-function analyzer for success0/failure17; omit it for missing-command127. Empty PATH explicitly, disable shell profile/rc loading and give the child a minimal environment. Assert exact exit, flags, no signal and no subprocess error. Remove only the owned temporary directory in `finally`.
4. Invoke the same checker through `process.execPath` from the existing Vitest receipt suite, with subject root pinned to that repository and a5s outer timeout. Do not remove existing receipt cases.
5. Freeze source and obtain251's serialized execution. Run the same checker against exact pre-fix package source and the candidate; preserve all original outputs and source hashes. Then execute ordinary wrapper/lint/type/harness qualification through the same owner.
6. Complete any documentation refusal against the existing validator, never change the validator or disguise a failed check. Recheck only the changed documentation/policy surface in the next authorized slot; no source repair or unnecessary real-test rerun.
7. After policy qualification, execute normal hooks/commit in an authorized slot, bind independent review to the eventual commit and pass all required protected CI. Coordinate pushes with251 to avoid cancelling other packaged checks. Merge only when all applicable gates pass; otherwise retain the precise blocker.

Canonical standalone command:

```sh
node --test --test-concurrency=1 tools/test/analysis-enforcement.test.mjs
```

The same command accepts `ANALYSIS_SUBJECT_ROOT` only as a test subject selector for frozen baseline replay; the ordinary Vitest wrapper pins it to the current repository. It is not a production verification bypass.

## Measured Evidence and Remaining Gates

- Candidate1 and diagnostic1 were RED: the filesystem fake command was not found. Stderr was retained; no host-specific interpreter/root-cause claim is made.
- Final correction2 replaced the unnecessary filesystem shim with the shell-function fake, retaining all outcome/argument assertions. At15:23:37–15:23:42, baseline exit1 versus candidate exit0/3of3; source+baseline8/8; unchanged225 restored/window158.
- Exact-code fullGLM5.3 review (OpenAI generator, different-family) allowed all three axes. Hashes and limitations are in `reports/source-review.md`; no self-judged score claim.
- Ordinary1 at15:54:51–15:55:09: offline hydration0, wrapper4/4, scoped TS ESLint0 and tsc0, source8/8. `make harness-check` exited2 because the earlier short spec/plan omitted the required completed-specification sections. This document completion corrected that refusal, not another source repair. Ordinary2-docs at16:03:56–16:04:00 passed the actual `make harness-check` (exit0,4.018s), source8/8; unchanged225 restored/window162/restore0. The earlier refusal remains retained.
- Normal hooks, commit, eventual exact-head review binding, required CI, merge, actual100% coverage and full-stack perfection are not established by the above.

## Review and Scope Reconciliation

The preliminary plan's independent review assumed a `pnpm gates` caller and missing formatter check that did not exist; those premises were explicitly rejected after reading source. Fresh main also already closed optional Clippy. No corresponding speculative edits landed. Final source review covered the narrowed three-file change only.

The native-policy increment was separately reviewed before applying additive CodeQL all-severity main ruleset23477091. Exact GET/effective-rule readback and existing-rule parity passed. Its PR-diff/merge-queue limitations and one-rule DELETE reversal are in `reports/DELIVERY.md`; no further settings change is requested by this plan.

## Reversal and Delivery Boundary

Before merge, retain the isolated255 branch and frozen evidence without modifying reader225. After merge, reverse the code increment through one revert PR of its squash commit. The independently applied native rule has its own recorded one-rule rollback; do not remove existing protections. This branch's completion does not close the broader perfect-score campaign.
