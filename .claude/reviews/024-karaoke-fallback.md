# Codex Adversarial Review — 024-karaoke-fallback (P1 #7 pt.3 foundation)

- **Date:** 2026-05-31
- **Commit reviewed:** `0ad234d`; test added (unequal-length proportionality) → amended to `954bdd5` (no production change).
- **Tool:** `codex exec --sandbox read-only` (Codex v0.134.0, gpt-5.5)
- **Scope:** `git diff origin/main...HEAD` — `src/lib/tts-tracking.ts` (+`segmentSentencesWithOffsets`, `buildSentenceFallbackTimings`), `src/__tests__/unit/tts-fallback.test.ts`.

## Verdict: PASS

**BLOCKER / MAJOR / MINOR:** none.

Codex confirmed:
- **Offsets correct** — original-text UTF-16 indices; every tested case checks out (two sentences, leading/trailing trim, trailing fragment, `"?!"` run, closing quote, accented `"café."`); no off-by-one that would misalign a DOM range.
- **Timing** — proportional spread, last span ends exactly at duration (no float drift), gapless/monotonic, ~150-wpm estimate when duration ≤ 0, `[]` for empty text. Tests are meaningful (exact span objects, `toBe` on final duration, monotonic checks), not vacuous.
- **Deferral is legitimate** — the hook completes on `elapsed >= state.totalDuration`, and the backend reports `total_duration = 0.0` when alignment is absent; wiring fallback timings with only an *estimated* duration could mark playback complete before the real audio ends (or keep highlighting after it ends). A safe wiring needs a real positive audio duration / playback-ended signal first. → that wiring is pt.3b.
- No new deps, two frontend TS files only, no Tauri capability/scope change, no new `invoke`, `WordTiming` import is type-only.

**TEST GAP (Codex):** no unequal-length proportionality test. **Addressed** in amend `954bdd5` (`"Hi. Hello there world."` → first span exactly 3s of 21s). No Codex re-run: test-only, production logic unchanged, addresses Codex's own note.

Codex could not run the tests (no `pnpm` in sandbox). Verified here: `pnpm lint` 0 errors, `pnpm typecheck` exit 0, `pnpm exec vitest run …tts-fallback.test.ts` → 12/12 pass.

Full log: `/tmp/lectrice-024-codex.log`.
