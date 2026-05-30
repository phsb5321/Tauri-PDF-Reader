# Lectrice — Agent Backlog State

> Durable handoff for the `/loop` / lectrice-forward workflow. Latest first.

## Iteration #6 — 2026-05-30 (Spec 013: Library Store Query Tests)

- **Branch:** `013-library-store-tests` (off `origin/main` 7c5de09). Test-only. Commit pending below.
- **Slice:** coverage of `library-store` (009 follow-through). +12 tests for `getFilteredDocuments` (search title+filePath case-insensitive/trimmed; sorts title/created/recent incl. the lastOpenedAt-wins + createdAt-fallback branches; no-mutation) + count selectors. `setState`-seeded, no IPC mocks.
- **Verified:** `vitest run library-store` 12 pass; `pnpm typecheck` clean. Codex 2 rounds → pass (r1 MAJOR: recent-sort wasn't discriminating → added a fixture where lastOpenedAt and createdAt orders disagree). `.claude/reviews/013-library-store.md`.
- **Next slice:** remaining 0%-covered stores (settings-store, tts-store); the tiny `specta_builder` cfg-gate cleanup (012 finding); OR — higher leverage — Pedro reviews/merges 008–013 and steers the next tier (P2 pdf.js 5.x, P3 Kokoro/accessibility, S2 library-reopen UX).

## Earlier iterations (all 2026-05-30, off origin/main 7c5de09, unmerged)

- **#5 Spec 012 `012-release-smoke` `61626ed`** — P0#5: `cargo build --release` PASS (15MB stripped). Bundle BLOCKED (linuxdeploy/appimagetool/cargo-tauri absent → narrow `targets` or provision toolchain). WEBKIT DMABUF item inapplicable. Benign `specta_builder` release warning (cfg-gate cleanup deferred). Docs-only.
- **#4 Spec 011 `011-highlight-store-tests` `32f98bb`** — +15 tests for `tts-highlight-store` (karaoke state machine). Codex caught a weak resume assertion → stubbed `performance.now` to assert the re-anchor. Test-only.
- **#3 Spec 010 `010-word-timing-tests` `8ba95b1`** — +8 tests for `chars_to_words`; exposed + **FIXED** a real bug (byte vs UTF-16 offsets broke non-ASCII highlight → `encode_utf16().count()`). Codex Pass. Residual: GUI smoke for non-ASCII highlight.
- **#2 Spec 009 `009-coverage-gate` `5c98fc3`** — `vitest` thresholds flat 80 → ratcheted floors (42/42/53/80), documented (`docs/coverage-budget.md`); CI green. Follow-up: raise floors after 010/011/013 land.
- **#1 Spec 008 `008-security-housekeeping` `93065ac`** — asset scope `[]`; fs scope `$APPLOCALDATA/**`; backend `validate_pdf_path` (canonicalize+`.pdf`+fstat) on file-ingest cmds; metadata. 8 tests. Codex 4 rounds → Pass. Follow-ups: S2 persisted-scope, S-provenance, WebView raw-SQL.

## Standing context

- **6 branches off `origin/main` (7c5de09), unmerged, awaiting Pedro's push/PR.** This 013 `agent-backlog-state.md` is cumulative latest. Merge-coupling: 010/011/013 coverage credits 009's ratchet → bump 009 floors after they land.
- **Main worktree dirty = accidental deletions, untouched.** Recommend Pedro: `git restore .gitignore .specify e2e specs .claude/commands`.
- **Build env:** pnpm `~/.local/share/pnpm` (export PATH for husky too); cargo/Tauri need the nix-shell (`pkg-config openssl alsa-lib gnumake gtk3 webkitgtk_4_1 libayatana-appindicator librsvg speechd`); `generate_context!`/build need a `dist/` stub; release build ≈9 min; bundle toolchain absent. tsconfig EXCLUDES `*.test.ts` from `tsc` (test types only checked by the LSP).
- **Loop:** hourly cron `7 * * * *` (`473ce7f0`, session-only). Re-running `/loop 60m /lectrice-forward` does NOT duplicate.
- **Open worktrees to clean post-merge:** `-008-…` through `-013-…`.

### Next command

`/loop 60m /lectrice-forward` (scheduled).
