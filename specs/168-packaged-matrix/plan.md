# Implementation Plan: Packaged Matrix Reliability

**Branch**: `168-packaged-matrix` | **Date**: 2026-08-22 | **Spec**: [spec.md](./spec.md)

## Summary

Repair the existing packaged harness at its shared environment boundary: derive one application identity from Cargo output, declare SQLite with the other lane tools, route the remaining private lane through the shared dev shell, and create profiles under the Linux path accepted across nested Nix shells. Keep product code and workflow files unchanged.

## Constitution Check

- Hexagonal/product architecture: PASS — no product layer changes.
- Typed IPC ratchet: PASS — no IPC changes.
- Test-first: PASS — the extended harness contract was red before implementation and green after.
- Verification discipline: PASS — packaged highlight, reader, and close journeys remain deterministic judges.
- Resource discipline: PASS — targeted tests and affected lanes run sequentially.

## Technical Context

- Shared environment: `flake.nix`, `scripts/e2e-toolchain.sh`, `scripts/e2e-profile.sh`
- Lane migration: `e2e/run-highlight-journey.sh`
- Process observers: close runner/spec and real-corpus spec
- Launcher: `wdio.conf.mjs`
- Contracts: existing integration tests under `src/__tests__/integration/`
- Dependencies: no new project dependency; use the SQLite executable already available from the pinned package set

## Design

1. Export one absolute `E2E_APP_PATH` beside the existing CI Cargo target setup.
2. Make launcher and observers consume that identity and fail when it is absent where observation is required.
3. Move the highlight lane from its private package list to `toolchain_exec`.
4. Add SQLite to the flake dev shell because multiple lane observers invoke it.
5. Pin generated profiles under literal `/tmp`, which the fixture guard accepts across nested shell `TMPDIR` changes.
6. Extend the existing toolchain and launcher contracts rather than add a second test framework.

## Verification

1. Shell/ESM syntax and `git diff --check`.
2. Targeted toolchain and launcher contract tests.
3. `nix develop` proves `sqlite3` and `tauri-driver` availability.
4. Packaged highlight and reader journeys.
5. Packaged close journey with retained timing anomalies and one complete green replay.
6. Different-family exact-head review, required PR checks, and scheduled full matrix.

## Rollback

One squash-revert PR restores the prior harness. No product or user data migration is involved.
