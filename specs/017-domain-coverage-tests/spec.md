# Spec 017 — Remaining Pure-Domain Coverage

**Status:** Implemented
**Branch:** `017-domain-coverage-tests` (stacked on `009-coverage-gate`)
**Date:** 2026-05-30

## Problem

Three pure domain modules were 0% covered: `domain/rendering/QualityMode.ts`,
`domain/export/export-result.ts`, `domain/cache/cache-entry.ts`. They hold
regressable logic (DPR-clamped output scale, export progress/phases, cache
age/usage thresholds). Covered together to finish the pure-domain layer in one
slice.

## Tests

- **quality-mode** — config min-scales; `getMinOutputScale` clamps to max(config, DPR); `getQualityModeOptions` (3 labelled); `isValidQualityMode` (valid + case-sensitive reject).
- **export-result** — `createDefaultExportOptions` (mp3 + per-page chapters); `calculateExportPercent` (divide-by-zero + rounding); `isExportComplete`/`isExportError`; `getPhaseDescription` (all phases + fallback).
- **cache-entry** — `belongsToDocument`; `getCacheEntryAge`/`getTimeSinceAccess` (Date.now stubbed for determinism); `isNearLimit` (max=0, default 0.9, custom threshold); `getCacheUsagePercent` (max=0, rounding).

## Verification

`pnpm test:coverage` (gate green — pure modules raise coverage), `pnpm typecheck`.
No production code change. Stacked on 009 for the ratchet.

## Rollback

`git revert` (test-only).
