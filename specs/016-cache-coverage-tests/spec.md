# Spec 016 — Audio-Cache Coverage Domain Tests

**Status:** Implemented
**Branch:** `016-cache-coverage-tests` (stacked on `009-coverage-gate`)
**Date:** 2026-05-30

## Problem

`src/domain/cache/coverage.ts` (spec 006 audio-cache coverage helpers) was 0%
covered. Pure functions with regressable arithmetic/formatting:
`calculateCoveragePercent` (divide-by-zero guard + rounding), `isFullyCached`
(the `total > 0` guard), and the human-readable `formatCoverage` /
`formatDuration` (ms/s/m/h boundaries) / `formatBytes` (log/pow unit selection)
formatters, plus `emptyCoverageStats`.

## Goal

Unit-test the module. Pure domain → no mocks, no IO. Test-only; continues spec
009's "raise floors as tests land".

## Tests (14)

- `calculateCoveragePercent`: total=0 → 0 (no divide-by-zero); 50/100/33/67 rounding.
- `isFullyCached`: full → true; partial → false; 0-of-0 → false (guard).
- `formatCoverage`: "No audio cached" when empty; "P% cached (c/t chunks)".
- `formatDuration`: `0/999ms`, `1s/5s`, `1m 5s`, `1h 0m`, `1h 5m` (unit boundaries).
- `formatBytes`: `0 B`, `512 B`, `1 KB`, `1.5 KB`, `1 MB`, `1 GB`.
- `emptyCoverageStats`: zeroes all counts, stamps documentId + a parseable ISO timestamp.

## Verification

`pnpm test:coverage` (gate passes — module is pure, fully covered, raises
coverage), `pnpm typecheck`. No production code change.

## Note

Branched on `009-coverage-gate` so the ratcheted thresholds apply (the module is
pure with no import chain, so unlike spec 013 it only raises coverage). Merge
after 009.

## Rollback

`git revert` (test-only).
