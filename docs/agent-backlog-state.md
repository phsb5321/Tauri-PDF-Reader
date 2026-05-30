# Lectrice — Agent Backlog State

> Durable handoff for the `/loop` / lectrice-forward workflow. Latest first.

## Iteration #8 — 2026-05-30 (Spec 015: TTS Store Tests)

- **Branch:** `015-tts-store-tests` (off `origin/main` 7c5de09). Test-only. Commit pending below.
- **Slice:** coverage of `tts-store` (native-TTS chunk-queue state machine, 0% covered; pure, no IPC). +21 tests: rate clamp [0.5,3.0], init mapping, queue ops, `setCurrentChunk` (index/id-lookup/null/unknown-id), navigation bounds (next/previous/getCurrent incl. middle + out-of-range), selectors (true AND false), reset.
- **Verified:** `vitest run tts-store` 21 pass; `pnpm typecheck` clean. Codex → acceptable (added discriminating tests for its MINORs). `.claude/reviews/015-tts-store.md`.
- **Store coverage now largely complete:** highlight (011), library (013), settings (014), tts (015) all covered; `ai-tts-store` already has `ai-tts-state-machine.test.ts`. **Remaining 0% surfaces are React components/hooks** (need testing-library setup, heavier) or the bigger feature tier.
- **Next slice options:** (a) a hook/util with pure logic (e.g. `coordinate-transform` is already tested; look for an untested pure lib); (b) the `specta_builder` cfg cleanup (012 finding, needs a release build to verify); (c) **— highest leverage — Pedro reviews/merges 008–015 and steers the next tier** (P2 pdf.js 5.x, P3 Kokoro/accessibility, S2 library-reopen UX).

## Earlier iterations (all 2026-05-30, off origin/main 7c5de09, unmerged)

- **#7 Spec 014 `014-settings-store-tests` `7bcae2d`** — +15 tests for `settings-store` (rate clamp, load/sync, setters; IPC mocked). Codex PASS.
- **#6 Spec 013 `013-library-store-tests` `675b3ba`** — +12 tests for `getFilteredDocuments` (search + 3 sorts incl. lastOpenedAt-wins). Codex pass.
- **#5 Spec 012 `012-release-smoke` `61626ed`** — P0#5: `cargo build --release` PASS (15MB stripped); bundle BLOCKED (toolchain absent). Docs-only.
- **#4 Spec 011 `011-highlight-store-tests` `32f98bb`** — +15 tests for `tts-highlight-store`. Codex strengthened a weak resume assertion.
- **#3 Spec 010 `010-word-timing-tests` `8ba95b1`** — +8 tests; **FIXED** byte-vs-UTF-16 offset bug (non-ASCII highlight). Codex Pass. Residual: GUI smoke.
- **#2 Spec 009 `009-coverage-gate` `5c98fc3`** — `vitest` 80 → ratcheted floors (42/42/53/80), documented. CI green. Follow-up: raise floors after the test branches land.
- **#1 Spec 008 `008-security-housekeeping` `93065ac`** — asset scope `[]`; fs scope `$APPLOCALDATA/**`; backend `validate_pdf_path`; metadata. 8 tests. Codex 4 rounds → Pass. Follow-ups: S2 persisted-scope, S-provenance, WebView raw-SQL.

## Standing context

- **8 branches off `origin/main` (7c5de09), unmerged, awaiting Pedro's push/PR.** This 015 doc is cumulative latest. Coverage branches (010/011/013/014/015) credit 009's ratchet → bump 009 floors after they land. Checked tick #8: origin unchanged, no new PRs — nothing merged yet.
- **Main worktree dirty = accidental deletions, untouched.** Recommend: `git restore .gitignore .specify e2e specs .claude/commands`.
- **Build env:** pnpm `~/.local/share/pnpm` (export PATH for husky); cargo/Tauri need the nix-shell; build needs a `dist/` stub; release ≈9 min; bundle toolchain absent. tsconfig EXCLUDES `*.test.ts` from `tsc`; non-exported store types cascade implicit-any in the LSP pre-install (resolves after `pnpm install`).
- **Loop:** hourly cron `7 * * * *` (`473ce7f0`, session-only). Re-running `/loop 60m /lectrice-forward` does NOT duplicate.
- **Open worktrees to clean post-merge:** `-008-…` through `-015-…`.

### Next command

`/loop 60m /lectrice-forward` (scheduled).
