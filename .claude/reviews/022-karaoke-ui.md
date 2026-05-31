# Codex Adversarial Review — 022-karaoke-ui (P1 #7, part 1)

- **Date:** 2026-05-31
- **Commit:** `612188e` (branch `022-karaoke-ui`, base `origin/main` 8c366d7)
- **Tool:** `codex exec --sandbox read-only` (Codex v0.134.0, gpt-5.5)
- **Scope:** `git diff origin/main...HEAD` — `src/lib/tts-tracking.ts`, `src/hooks/useTtsWordHighlight.ts`, `src/__tests__/unit/tts-tracking.test.ts`.

## Verdict: PASS

**BLOCKER:** none. **MAJOR:** none. **MINOR:** none.

Codex diffed the original inline rAF loop against the extracted `findWordIndexAtTime` and confirmed it is **behavior-preserving**:
- In-range `elapsed >= startTime && elapsed < endTime` — matches.
- Gap-fill `elapsed >= word.endTime && elapsed < nextWord.startTime` → hold word `i` — matches.
- Tail: if still `-1` and `elapsed >= lastWord.startTime` → last index — matches.
- Empty list and pre-first-word still return `-1` (no accidental `0` fallback) — matches.

Also confirmed: the hook still gates store/callback updates on `newWordIndex !== lastWordIndexRef.current && newWordIndex >= 0` (no new per-frame thrash); only the 3 files above changed; no package/lockfile change, no Tauri capability/scope change, no direct `invoke()`; a hook importing a pure `src/lib` utility respects the existing boundaries. Tests cover empty / pre-start `-1` / `[start,end)` boundaries / gap-fill (incl. exact gap start) / tail (incl. exact last end + far past) / single-word.

**TEST GAPS:** Codex could not execute the tests in its read-only sandbox (`pnpm` absent; Vite couldn't write its temp config). Resolved here: `pnpm exec vitest run …` → **7/7 pass**; `pnpm lint` 0 errors; `pnpm typecheck` exit 0.

Full log: `/tmp/lectrice-022-codex.log`.
