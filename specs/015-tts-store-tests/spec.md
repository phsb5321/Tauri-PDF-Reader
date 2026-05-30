# Spec 015 — TTS Store Tests

**Status:** Implemented
**Branch:** `015-tts-store-tests` (off `origin/main` @ 7c5de09)
**Date:** 2026-05-30

## Problem

`src/stores/tts-store.ts` (the native-TTS chunk-queue state machine) was 0%
covered. It is pure (no IPC) but holds the regressable navigation logic that
drives sentence-by-sentence playback: `nextChunk`/`previousChunk` bounds,
`setCurrentChunk` (explicit index / id-lookup / clear), `getCurrentChunk`, queue
ops, and `setRate` clamping to [0.5, 3.0].

## Goal

Unit-test the store's logic. Pure store → no mocks. Test-only; continues spec
009's "raise floors as tests land".

## Tests (21)

Includes the discriminating cases Codex r1 asked for: `nextChunk` middle
(1→2), `setCurrentChunk` unknown id (findIndex miss → index -1),
`getCurrentChunk` out-of-range cursor, and selectors asserting both true AND
false.

- `setRate` clamp (below/above/in-range).
- `setInitialized` maps `TtsInitResponse` → state.
- queue: `setChunks` resets cursor; `addChunk` appends; `clearChunks` empties + resets.
- `setCurrentChunk`: explicit index; id-lookup via `findIndex`; null clears.
- navigation: `nextChunk` advances / returns null at end (no move);
  `previousChunk` back / returns null at start (no move); `getCurrentChunk`
  valid-vs-null.
- selectors: `selectIsPlaying`/`Paused`/`Loading`; `selectCanPlay` requires
  initialized AND available.
- `reset` restores initial state.

## Verification

`pnpm exec vitest run tts-store`, `pnpm typecheck`. No production code or
`vitest.config.ts` change (009 owns the gate). Merges cleanly with 008–014.

## Rollback

`git revert` (test-only).
