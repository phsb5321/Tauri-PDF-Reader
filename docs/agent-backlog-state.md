# Lectrice — Agent Backlog State

> Durable handoff for the `/loop` / lectrice-forward workflow. Latest first.

## Iteration #7 — 2026-05-30 (Spec 014: Settings Store Tests)

- **Branch:** `014-settings-store-tests` (off `origin/main` 7c5de09). Test-only. Commit pending below.
- **Slice:** coverage of `settings-store` (009 follow-through). +15 tests (Tauri IPC mocked via `vi.mock`): `setTtsRate` clamp [0.5,3.0] (accessibility speed bound), setters, `reset`, `loadFromDatabase` apply/fallback/error, `syncToDatabase`.
- **Verified:** `vitest run settings-store` 15 pass; `pnpm typecheck` clean. Codex → PASS (added 4 tests for the noted MINOR gaps). `.claude/reviews/014-settings-store.md`.
- **Next slice:** `tts-store` (last big 0% store); the `specta_builder` cfg cleanup (012 finding). **But the binding constraint remains Pedro:** 7 verified branches sit unpushed/unmerged; merging + steering the next tier (P2 pdf.js 5.x, P3 Kokoro/accessibility, S2 library-reopen UX) is far higher leverage than more coverage ticks.

## Earlier iterations (all 2026-05-30, off origin/main 7c5de09, unmerged)

- **#6 Spec 013 `013-library-store-tests` `675b3ba`** — +12 tests for `getFilteredDocuments` (search + 3 sorts incl. lastOpenedAt-wins) + selectors. Codex 2 rounds → pass.
- **#5 Spec 012 `012-release-smoke` `61626ed`** — P0#5: `cargo build --release` PASS (15MB stripped). Bundle BLOCKED (linuxdeploy/appimagetool absent → narrow targets / provision toolchain). WEBKIT DMABUF item inapplicable. Benign `specta_builder` release warning (cfg-gate cleanup deferred). Docs-only.
- **#4 Spec 011 `011-highlight-store-tests` `32f98bb`** — +15 tests for `tts-highlight-store`. Codex strengthened a weak resume assertion. Test-only.
- **#3 Spec 010 `010-word-timing-tests` `8ba95b1`** — +8 tests for `chars_to_words`; exposed + **FIXED** byte-vs-UTF-16 offset bug (non-ASCII highlight). Residual: GUI smoke. Codex Pass.
- **#2 Spec 009 `009-coverage-gate` `5c98fc3`** — `vitest` thresholds 80 → ratcheted floors (42/42/53/80), documented. CI green. Follow-up: raise floors after 010/011/013/014 land.
- **#1 Spec 008 `008-security-housekeeping` `93065ac`** — asset scope `[]`; fs scope `$APPLOCALDATA/**`; backend `validate_pdf_path` on file-ingest cmds; metadata. 8 tests. Codex 4 rounds → Pass. Follow-ups: S2 persisted-scope, S-provenance, WebView raw-SQL.

## Standing context

- **7 branches off `origin/main` (7c5de09), unmerged, awaiting Pedro's push/PR.** This 014 doc is cumulative latest. Coverage branches (010/011/013/014) credit 009's ratchet → bump 009 floors after they land.
- **Main worktree dirty = accidental deletions, untouched.** Recommend: `git restore .gitignore .specify e2e specs .claude/commands`.
- **Build env:** pnpm `~/.local/share/pnpm` (export PATH for husky); cargo/Tauri need the nix-shell (`pkg-config openssl alsa-lib gnumake gtk3 webkitgtk_4_1 libayatana-appindicator librsvg speechd`); build needs a `dist/` stub; release ≈9 min; bundle toolchain absent. tsconfig EXCLUDES `*.test.ts` from `tsc`.
- **Loop:** hourly cron `7 * * * *` (`473ce7f0`, session-only). Re-running `/loop 60m /lectrice-forward` does NOT duplicate.
- **Open worktrees to clean post-merge:** `-008-…` through `-014-…`.

### Next command

`/loop 60m /lectrice-forward` (scheduled).
