# Spec 014 — Settings Store Tests

**Status:** Implemented
**Branch:** `014-settings-store-tests` (off `origin/main` @ 7c5de09)
**Date:** 2026-05-30

## Problem

`src/stores/settings-store.ts` (~200 lines) was 0% covered (spec-009 baseline).
It holds real logic worth protecting: **TTS-rate clamping to [0.5, 3.0]** (the
accessibility speed bound), `loadFromDatabase` value-mapping with per-key
fallbacks, an error path, and `reset`. The setters fire Tauri IPC
(`settingsSet`/`settingsSetBatch`) as fire-and-forget side effects.

## Goal

Unit-test the store's logic with Tauri IPC mocked (`vi.mock` on
`../lib/tauri-invoke`). Test-only; continues spec 009's "raise floors as tests
land".

## Tests (15)

- `setTtsRate` clamping: below-min → 0.5, above-max → 3.0, in-range unchanged.
- setters: `setTheme`, `setTtsFollowAlong`, telemetry flags, runtime TTS flags,
  `setHighlightDefaultColor`, `setHighlightColors`, `setTtsVoice`.
- `reset` restores defaults (`DEFAULT_TTS_RATE`, theme `system`, telemetry).
- `loadFromDatabase`: applies stored values + marks `dbInitialized`; falls back
  to current values when keys absent; records `error` + still sets
  `dbInitialized` on a rejected `settingsGetAll`.
- `syncToDatabase`: writes the current settings in one `settingsSetBatch`.

IPC is mocked, so no backend is needed and there are no live writes. `localStorage`
(persist middleware) is cleared in `beforeEach`.

## Verification

`pnpm exec vitest run settings-store`, `pnpm typecheck`. No production code or
`vitest.config.ts` change (009 owns the gate). Merges cleanly with 008–013.

## Rollback

`git revert` (test-only).
