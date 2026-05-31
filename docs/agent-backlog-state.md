# Lectrice — Agent Backlog State

> Durable handoff for the `/loop` / lectrice-forward workflow. Latest first.

## Iteration #15 — 2026-05-31 (Spec 025: Page-Boundary-Safe Word Range, P1 #7 pt.4)

- **Branch:** `025-page-boundary` (off `origin/main` 8c366d7). Commit `f1c0619`. Local only — awaiting push/PR.
- **Slice:** P1 #7 pt.4. `createWordRange` clamped a multi-node overrun to the START node's end (highlighted too little) + silent-null'd off-page words. Extracted pure `resolveCharRange(nodeLengths, charOffset, charLength)` → clamps overrun to the LAST node (`clamped:true`) so a page-straddling word highlights its on-page portion; null when off-page. `createWordRange` now collects nodes + delegates. 3 files, +7 tests.
- **Verified:** `pnpm lint` 0 errors; `pnpm typecheck` exit 0; `vitest run …tts-range.test.ts` → 7/7. Codex ran `tsc` too.
- **Codex:** `.claude/reviews/025-page-boundary.md` — VERDICT **PASS**. Caught a VACUOUS clamp test (start==last node → old-bug & fix identical) → replaced with `[5,3,4],6,10` distinguishing case; added `>total` off-page case. Both amended.
- **#7 now logic-complete (unit level):** pt.1 selection (022) · pt.2 reduced-motion (023) · pt.3 fallback foundation (024) · pt.4 page-boundary (025). **NOT done: end-to-end GUI verification of karaoke during real playback (needs Pedro/running app).**
- **Next slice:** small **backend "expose audio duration / playback-ended"** slice → unblocks **pt.3b** (wire the sentence fallback safely without cutting off audio). Then **P2 #8 pdf.js 5.x** (big migration). 
- **⚠️ STRONG RECOMMENDATION: pause new slices — 7 stacked loop branches (019–025) now await review/merge + the karaoke needs a GUI pass. Higher leverage to merge the batch + Pedro GUI-checks karaoke than to mine more sub-parts.**

## Iteration #14 — 2026-05-31 (Spec 024: Sentence-Level Karaoke Fallback, P1 #7 pt.3 foundation)

- **Branch:** `024-karaoke-fallback` (off `origin/main` 8c366d7). Commit `954bdd5`. Local only — awaiting push/PR.
- **Slice:** P1 #7 pt.3 foundation. When ElevenLabs returns no alignment the highlight shows nothing. Added pure `tts-tracking.ts` builders: `segmentSentencesWithOffsets(text)` (sentences with ORIGINAL-text UTF-16 offsets — `splitIntoSentences` normalizes whitespace + loses offsets, so can't reuse) and `buildSentenceFallbackTimings(text, totalDurationSeconds)` (one WordTiming/sentence, proportional spread, ~150 wpm estimate when duration ≤0). 2 files, +12 tests.
- **Deliberately NOT wired** into the hook: the loop completes on `elapsed >= totalDuration → onComplete`, and the backend reports `total_duration=0` with no alignment — feeding fallback timings with an *estimated* duration could cut off real audio. Safe wiring needs a real audio-duration/playback-ended signal → **pt.3b**.
- **Verified:** `pnpm lint` 0 errors; `pnpm typecheck` exit 0; `vitest run …tts-fallback.test.ts` → 12/12 pass.
- **Codex:** `.claude/reviews/024-karaoke-fallback.md` — VERDICT **PASS**, no findings; confirmed offsets correct + the deferral legitimate. Its TEST-GAP (unequal-length proportionality) added via amend.
- **Next slice:** **P1 #7 pt.4 — page-boundary range handling** in `TtsWordHighlight.createWordRange` (a word/sentence range crossing a PDF page container fails silently; detect + degrade). pt.3b (wire fallback) is PARKED pending a real audio-duration signal (small backend change). After #7: **P2 pdf.js 5.x**.

## Iteration #13 — 2026-05-31 (Spec 023: Reduced-Motion Scroll-to-Word, P1 #7 pt.2)

- **Branch:** `023-reduced-motion` (off `origin/main` 8c366d7). Commit `2e1db32`. Local only — awaiting push/PR.
- **Slice:** P1 #7 pt.2. `AiPlaybackBar` scroll-to-word used `scrollIntoView({behavior:"smooth"})` unconditionally — animated even under `prefers-reduced-motion`. Added pure `src/lib/reduced-motion.ts` (`prefersReducedMotion()` reads `globalThis.matchMedia`; `reducedMotionScrollBehavior()` → `"auto"`|`"smooth"`); used it for both scroll calls. 3 files, frontend-only.
- **Verified:** `pnpm lint` 0 errors; `pnpm typecheck` exit 0; `pnpm exec vitest run …reduced-motion.test.ts` → 5/5 pass.
- **Codex:** `.claude/reviews/023-reduced-motion.md` — round 1 **CHANGES REQUIRED** (SSR branch unasserted) → fixed by switching to `globalThis.matchMedia` (single fully-tested guard) → round 2 **PASS**.
- **Next slice:** **P1 #7 pt.3 — sentence-level fallback** when `wordTimings` is empty/sparse (`useTtsWordHighlight` shows nothing today; wire chunk/sentence highlight). Then pt.4 page-boundary range handling in `TtsWordHighlight.createWordRange`. Then P2 (pdf.js 5.x).

## Iteration #12 — 2026-05-31 (Spec 022: Karaoke Word-at-Time Selection, P1 #7 pt.1)

- **Branch:** `022-karaoke-ui` (off `origin/main` 8c366d7). Commit `612188e`. Local only — awaiting push/PR.
- **Slice:** P1 #7 (karaoke highlight UI). Explore-agent gap analysis: consumer largely built; "no per-tick DOM thrash" already DONE. The core word-at-time selection was correct but baked into `useTtsWordHighlight`'s rAF callback (untestable). Extracted it verbatim → pure `findWordIndexAtTime(elapsedSeconds, wordTimings)` in `src/lib/tts-tracking.ts`; rewired the hook; added 7 unit tests. 3 files, frontend-only.
- **Semantics (preserved):** in-range `[start,end)` → gap-fill (hold prev word in silent gaps) → tail (hold last past its start) → `-1` pre-first/empty. Structural `{startTime,endTime}` param (decoupled from `WordTiming` binding). Distinct from the chunk-path `getCurrentWordIndex` (returns 0 pre-start).
- **Verified:** `pnpm lint` 0 errors; `pnpm typecheck` exit 0; `pnpm exec vitest run …tts-tracking.test.ts` → 7/7 pass. (`pnpm test` is WATCH — use `vitest run` / `test:run`.)
- **Codex:** `.claude/reviews/022-karaoke-ui.md` — VERDICT **PASS**, no BLOCKER/MAJOR/MINOR; line-by-line confirmed behavior-preserving extraction.
- **Next slice:** **P1 #7 pt.2 — reduced-motion** (guard `AiPlaybackBar` scroll-to-word `behavior:"smooth"` on `prefers-reduced-motion`, + test), then pt.3 sentence-level fallback (empty/sparse `wordTimings`), then pt.4 page-boundary range handling. After #7: P2 (pdf.js 5.x upgrade).

## Iteration #11 — 2026-05-31 (Spec 021: With-Timestamps Wire-Contract Fixtures, P1 #6)

- **Branch:** `021-tts-timestamp-adapter` (off `origin/main` 8c366d7). Commit `409383c`. Local only — awaiting push/PR.
- **Slice:** P1 #6 (ElevenLabs stream-with-timestamps adapter). Gap analysis (Explore agent) found #6 mostly DONE — typed model, `chars_to_words` (8 tests, UTF-16-safe), deterministic `_ts` cache key all exist. The one untested seam was the **API wire contract** (JSON `/with-timestamps` body → typed model). Added 2 fixture tests + a buffering-vs-streaming doc comment. ALL in `src-tauri/src/ai_tts/elevenlabs.rs` (1 file, +76).
- **Tests:** `with_timestamps_response_deserializes_and_converts_end_to_end` (deserialize realistic JSON incl. ignored `normalized_alignment` → base64 decode → `chars_to_words` → assert words/times/duration) + `with_timestamps_response_tolerates_missing_alignment` (Option → None). No live API.
- **Verified:** nix-shell `cargo fmt --check` clean; `clippy --all-targets --features test-mocks -D warnings` clean; new tests pass + `chars_to_words` suite green + full backend 0 failed. No frontend change.
- **Codex:** `.claude/reviews/021-tts-timestamp-adapter.md` — VERDICT **PASS**, no BLOCKER/MAJOR/MINOR. Cross-checked the fixture vs ElevenLabs docs. Its TEST-GAP (add `normalized_alignment`) applied via amend `409383c`.
- **Streaming note:** "stream-while-caching" is N/A for `/with-timestamps` (base64-in-JSON; needs full body for alignment). Upstream `/stream/with-timestamps` (chunked) documented as a future option, not wired.
- **Next slice:** **P1 #7 karaoke highlight UI.** Consumer exists (`useTtsWordHighlight`, `TtsWordHighlight.tsx`, `tts-highlight-store`). Focus the UNVERIFIED quality reqs: no per-tick DOM thrash, punctuation/wrap/page-boundary handling, graceful sentence-level fallback, reduced-motion aware — add frontend tests for the word-at-time selection. Then P2 (pdf.js 5.x).

## Iteration #10 — 2026-05-31 (Spec 020: Persisted Scope, S2)

- **Branch:** `020-persisted-scope` (off `origin/main` 8c366d7). Commit `42c1ef8`. Local only — awaiting push/PR.
- **Slice:** S2 (P0#3 follow-up from 008). Add `tauri-plugin-persisted-scope` (2.3.5) AFTER `tauri_plugin_fs::init()` so the runtime per-file fs grant from `dialog.open()` survives restart → library documents reopen via `readFile(originalPath)` without re-prompting.
- **Scope-safety:** NO widening. Persists the fs plugin's existing `allowed_patterns()` (static `$APPLOCALDATA/**` + per-file runtime grants); introduces no new/broader pattern. Static fs + asset (`scope: []`) scopes untouched. No capability permission added (plugin has no commands). Local-only file, no network/telemetry.
- **Files:** `src-tauri/Cargo.toml` (+dep), `Cargo.lock`, `src-tauri/src/lib.rs` (builder line + rationale comment). 3 files, +38.
- **Verified (build):** nix-shell `cargo fmt --check` clean; `clippy --all-targets --features test-mocks -D warnings` clean; `cargo test --features test-mocks -j 1` → 273+ pass / 0 fail. persisted-scope 2.3.5 vs tauri 2.9.5. Frontend unchanged (no lint/typecheck delta).
- **Codex:** `.claude/reviews/020-persisted-scope.md` — VERDICT **PASS**, no BLOCKER/MAJOR. 1 MINOR (comment overstated "only picked files") FIXED via amend `42c1ef8`; 1 MINOR informational (asset grants not persisted — fine, app uses readFile not asset protocol).
- **REMAINING (manual GUI):** restart-reopen behavioral test — open a PDF from an arbitrary path, quit, relaunch, reopen from library; confirm no re-prompt. Not run (needs file-picker interaction); shipped build-verified per the loop's "ship narrowest safe + document remaining" allowance.
- **Next slice:** **P1 word-level karaoke** — #6 ElevenLabs stream-with-timestamps adapter (typed audio-chunk + char-alignment model; group chars→words; stream-while-caching; deterministic cache key; fixture tests, no live API), then #7 karaoke highlight UI. Spec-Kit it.

## Iteration #9 — 2026-05-31 (Spec 019: Coverage Ratchet)

- **Branch:** `019-coverage-ratchet` (off `origin/main` 8c366d7). Commit `42e5825`. Local only — awaiting push/PR.
- **Slice:** P0#4 coverage-gate decision. With 008–015 now merged to `main`, re-measured frontend coverage and ratcheted the `vitest.config.ts` regression floors UP to just under measured.
- **Numbers:** measured stmts 46.91 / branches 88.72 / funcs 59.58 / lines 46.91. Floors `42/53/80/42` → `46/59/88/46` (lines/functions/branches/statements). Never lowered. Target stays 80.
- **Files:** `vitest.config.ts` (thresholds + comment), `docs/coverage-budget.md` (new current-floor section + 009 kept as history).
- **Verified:** `pnpm test:coverage` passes the new floors twice (baseline measure + post-raise, exit 0, 555 tests / 33 files); `pnpm typecheck` clean (exit 0 — config file not in tsc include); `pnpm lint` 0 errors; `git diff --check` clean. Diff = 2 files.
- **Codex:** `.claude/reviews/019-coverage-ratchet.md` — VERDICT **PASS**, no BLOCKER/MAJOR/MINOR (independently recomputed every margin; its lone TEST GAP — "didn't re-run coverage" — resolved: we ran it twice locally).
- **Next slice:** **S2 persisted-scope** (P0#3 follow-up from 008) — add `tauri-plugin-persisted-scope` AFTER `tauri_plugin_fs::init()` so a picked PDF reopens after restart without re-granting; build+restart verify, else ship narrowest safe scope + document the exact remaining task. Then P1 word-level karaoke highlighting (#6/#7).

## Iteration #8 — 2026-05-30 (Spec 015: TTS Store Tests)

- **Branch:** `015-tts-store-tests` (off `origin/main` 7c5de09). Test-only. Commit pending below.
- **Slice:** coverage of `tts-store` (native-TTS chunk-queue state machine, 0% covered; pure, no IPC). +21 tests: rate clamp [0.5,3.0], init mapping, queue ops, `setCurrentChunk` (index/id-lookup/null/unknown-id), navigation bounds (next/previous/getCurrent incl. middle + out-of-range), selectors (true AND false), reset.
- **Verified:** `vitest run tts-store` 21 pass; `pnpm typecheck` clean. Codex → acceptable (added discriminating tests for its MINORs). `.claude/reviews/015-tts-store.md`.
- **Store coverage now largely complete:** highlight (011), library (013), settings (014), tts (015) all covered; `ai-tts-store` already has `ai-tts-state-machine.test.ts`. **Remaining 0% surfaces are React components/hooks** (need testing-library setup, heavier) or the bigger feature tier.
- **Next slice options:** (a) a hook/util with pure logic (e.g. `coordinate-transform` is already tested; look for an untested pure lib); (b) the `specta_builder` cfg cleanup (012 finding, needs a release build to verify); (c) **— highest leverage — Pedro reviews/merges 008–015 and steers the next tier** (P2 pdf.js 5.x, P3 Kokoro/accessibility, S2 library-reopen UX).

## Earlier iterations (#1–#8, all 2026-05-30 — now MERGED to origin/main @ 8c366d7)

- **#7 Spec 014 `014-settings-store-tests` `7bcae2d`** — +15 tests for `settings-store` (rate clamp, load/sync, setters; IPC mocked). Codex PASS.
- **#6 Spec 013 `013-library-store-tests` `675b3ba`** — +12 tests for `getFilteredDocuments` (search + 3 sorts incl. lastOpenedAt-wins). Codex pass.
- **#5 Spec 012 `012-release-smoke` `61626ed`** — P0#5: `cargo build --release` PASS (15MB stripped); bundle BLOCKED (toolchain absent). Docs-only.
- **#4 Spec 011 `011-highlight-store-tests` `32f98bb`** — +15 tests for `tts-highlight-store`. Codex strengthened a weak resume assertion.
- **#3 Spec 010 `010-word-timing-tests` `8ba95b1`** — +8 tests; **FIXED** byte-vs-UTF-16 offset bug (non-ASCII highlight). Codex Pass. Residual: GUI smoke.
- **#2 Spec 009 `009-coverage-gate` `5c98fc3`** — `vitest` 80 → ratcheted floors (42/42/53/80), documented. CI green. Follow-up: raise floors after the test branches land.
- **#1 Spec 008 `008-security-housekeeping` `93065ac`** — asset scope `[]`; fs scope `$APPLOCALDATA/**`; backend `validate_pdf_path`; metadata. 8 tests. Codex 4 rounds → Pass. Follow-ups: S2 persisted-scope, S-provenance, WebView raw-SQL.

## Standing context

- **008–015 are MERGED** into `origin/main` (now at `8c366d7`, PRs #6–#13). 009's floors are now superseded by 019's ratchet (46/59/88/46) — the "bump after test branches land" follow-up is DONE.
- **Unmerged branches awaiting push/PR (loop, off 8c366d7):** `025-page-boundary` (`f1c0619`, this iter), `024-karaoke-fallback` (`954bdd5`), `023-reduced-motion` (`2e1db32`), `022-karaoke-ui` (`612188e`), `021-tts-timestamp-adapter` (`409383c`), `020-persisted-scope` (`42c1ef8`), `019-coverage-ratchet` (`42e5825`). **7 stacked branches — STRONGLY recommend Pedro batch-review/merge now (merge oldest-first; each carries the cumulative backlog doc → `--theirs` the latest on conflict). Loop value is dropping vs. the review/GUI-verify backlog.** Also local-only: `016-cache-coverage-tests` / `017-domain-coverage-tests` (older base — rebase onto 8c366d7 + measure before they affect the coverage floor), and `018-render-perf` (UNCOMMITTED desktop-integration: GPU compositing + niri decorations + AT-SPI app-menu export — Pedro-directed, separate from the loop; see [[lectrice-niri-desktop-integration]]). NOTE: 019/020/021 each carry the cumulative `docs/agent-backlog-state.md`; merge oldest-first or `git checkout --theirs` the latest to resolve the add/add.
- **Main worktree dirty = accidental deletions, untouched, still on 6ccf946 (stale).** Recommend: `git restore .gitignore .specify e2e specs .claude/commands` then `git pull --ff-only`.
- **Build env:** pnpm `~/.local/share/pnpm` (export PATH for husky); cargo/Tauri need the nix-shell; build needs a `dist/` stub; release ≈9 min; bundle toolchain absent. tsconfig EXCLUDES `*.test.ts` from `tsc`; non-exported store types cascade implicit-any in the LSP pre-install (resolves after `pnpm install`).
- **Loop:** hourly cron `7 * * * *` (`473ce7f0`, session-only). Re-running `/loop 60m /lectrice-forward` does NOT duplicate.
- **Open worktrees:** `-008-…`–`-015-…` already removed post-merge. Current: `-016-…`, `-017-…`, `-018-render-perf`, `-019-coverage-ratchet`, `-020-persisted-scope`, `-021-tts-timestamp-adapter`, `-022-karaoke-ui`, `-023-reduced-motion`, `-024-karaoke-fallback`, `-025-page-boundary`, `-run` (detached dev-run @ 8c366d7; dev server currently stopped). Loop worktrees reuse `-run/node_modules` via symlink to skip redundant installs.

### Next command

`/loop 60m /lectrice-forward` (scheduled).
