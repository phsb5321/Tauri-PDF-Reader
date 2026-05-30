# Spec 013 — Library Store Query Tests

**Status:** Implemented
**Branch:** `013-library-store-tests` (off `origin/main` @ 7c5de09)
**Date:** 2026-05-30

## Problem

`src/stores/library-store.ts` was 0% covered (spec-009 baseline). Its
`getFilteredDocuments` holds real, regressable logic — search across BOTH
`title` and `filePath` (case-insensitive, trimmed) and three sort orders
(`title` asc with null→'', `created` desc, `recent` = `lastOpenedAt` desc with a
`createdAt` fallback) — plus the count selectors. This drives the library view;
a sort/filter regression is silent.

## Goal

Unit-test the pure query surface. Test-only; continues spec 009's "raise floors
as tests land" by covering another 0% store. The async actions (`loadDocuments`,
`removeDocument`, …) hit Tauri IPC and are out of scope here.

## Tests (18)

`getFilteredDocuments`: empty-query returns all; filter by title
(case-insensitive); filter by filePath substring (mixed-case query → also covers
filePath case-insensitivity); query trimming; no-match → empty; sort `title`
(null title → '' sorts first); sort `created` (newest first); sort `recent`
fallback to createdAt when lastOpenedAt null; sort `recent` proves lastOpenedAt
WINS over createdAt (discriminating fixture — Codex r1 gap); no-mutation.
Selectors (count / has). Async actions (IPC mocked): `loadDocuments`
(success + error), `removeDocument`, `updateDocumentTitle`, `relocateDocument`,
`checkFileExists`.

**Note:** `../lib/tauri-invoke` is `vi.mock`'d. This keeps the test focused on
the store AND keeps the uncovered real IPC chain out of the (import-driven)
coverage denominator — importing it unmocked dropped global function coverage
below the spec-009 ratchet floor and reddened CI. The async-action tests cover
the store's own functions for a comfortable margin (functions 54.7% vs 53 floor).

State is seeded with `setState` (not the async setters) so the pure derivation
is tested without mocking IPC.

## Verification

`pnpm exec vitest run library-store`, `pnpm typecheck`. No production code or
`vitest.config.ts` change (009 owns the gate). Merges cleanly with 008–012.

## Rollback

`git revert` (test-only).
