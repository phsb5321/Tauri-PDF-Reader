# Codex Adversarial Review — Spec 015 (TTS Store Tests)

- **Date:** 2026-05-30
- **Tool:** `codex exec --sandbox read-only` (codex-cli 0.133.0)
- **Verdict:** Acceptable — 0 BLOCKER, 0 MAJOR.

## Summary

Confirmed assertions match the store: `nextChunk`/`previousChunk` return null
without moving at edges, `setCurrentChunk` uses explicit index or `findIndex`,
`getCurrentChunk` null at -1. Production code unchanged.

## MINOR (addressed → 21 tests)

Codex noted the tests weren't fully discriminating. Added:

- `setCurrentChunk('ghost')` — unknown id → keeps id, index -1 (findIndex miss).
- `getCurrentChunk` out-of-range positive cursor (index = length) → null.
- `nextChunk` middle (1→2) — guards against an impl that only handles edges.
- selectors assert true AND false (an always-true selector now fails).

21 tests pass; `pnpm typecheck` clean. Test-only.
