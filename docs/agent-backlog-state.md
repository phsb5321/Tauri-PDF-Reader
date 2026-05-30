# Lectrice — Agent Backlog State

> Durable handoff for the `/loop` / lectrice-forward workflow. Latest iteration first.

## Iteration — 2026-05-30 #5 (Spec 012: Release / Bundle Smoke — P0#5)

- **Branch:** `012-release-smoke` (off `origin/main` 7c5de09). Docs-only. Commit pending below.
- **Slice:** P0#5 — does the aggressive release profile build, and can a bundle be produced?
- **Findings:**
  - `cargo build --release` **PASS** (rc=0, 9m13s) → `target/release/tauri-pdf-reader` 15 MB, stripped. Profile (lto+strip+panic=abort+opt-level=s) sound.
  - Benign release-only warning `unused variable: specta_builder` (lib.rs:213): specta builder is used only in the `#[cfg(debug_assertions)]` TS-binding export; release IPC mounts via `tauri::generate_handler!` (lib.rs:273). Cleanup deferred (cfg-gate the construction). Drift hazard: `collect_commands![]` (specta) vs `generate_handler![]` (IPC) are separate lists — keep in sync.
  - **Bundle BLOCKED:** `bundle.targets = "all"` but `linuxdeploy`/`appimagetool`/`cargo-tauri` absent → full `tauri build` cannot run here. **Recommendation:** narrow `bundle.targets` (e.g. `["deb"]`) or provision the bundling toolchain before any release.
  - WEBKIT research item (`DMABUF_RENDERER` vs `COMPOSITING_MODE`): inapplicable — `COMPOSITING_MODE=1` is only set in the hw-accel-disable path (full software render intent); no change.
- **Codex:** `.claude/reviews/012-release-smoke.md` — valid; 2 wording MINORs fixed; no BLOCKER/MAJOR against the slice.
- **Next slice:** P0 ladder now covered (1–5). Options: more 0%-covered store tests (settings/tts/library — coverage); the tiny `specta_builder` cfg-gate cleanup; OR surface the S2 library-reopen UX decision to Pedro. P2 (pdf.js 5.x upgrade) and P3 (Kokoro offline, accessibility) are larger and benefit from Pedro's steer.

## Iteration — 2026-05-30 #4 (Spec 011: TTS Highlight Store Tests) — branch `011-highlight-store-tests`, commit `32f98bb`
- +15 tests for `tts-highlight-store` (karaoke state machine, was 0%). Codex r1 caught a weak resume assertion → strengthened (stub `performance.now`, assert `now - pausedAtTime`) + pause-guard + subscription no-op + `afterEach` restore. Codex r2 → Sound. Test-only.

## Iteration — 2026-05-30 #3 (Spec 010: Word-Timing Tests + UTF-16 fix) — branch `010-word-timing-tests`, commit `8ba95b1`
- +8 tests for `chars_to_words`; exposed + **fixed** a real bug: byte vs UTF-16 offsets broke non-ASCII highlight → `encode_utf16().count()`. Codex 2 rounds → Pass.

## Iteration — 2026-05-30 #2 (Spec 009: Coverage Gate) — branch `009-coverage-gate`, commit `5c98fc3`
- `vitest.config.ts` flat 80 → ratcheted floors (42/42/53/80), documented (`docs/coverage-budget.md`). CI green. Codex PASS. Follow-up: raise floors as tests land (010/011 add coverage).

## Iteration — 2026-05-30 #1 (Spec 008: Security + Housekeeping) — branch `008-security-housekeeping`, commit `93065ac`
- Asset scope `[]`; fs scope `$APPLOCALDATA/**`; backend `validate_pdf_path` (canonicalize + `.pdf` + fstat) on `compute_file_hash` + `library_check_file_exists`. 8 tests. Metadata fixes. Codex 4 rounds → Pass. Follow-ups: S2 persisted-scope, S-provenance, WebView raw-SQL.

## Standing context

- **5 branches off `origin/main` (7c5de09), unmerged, awaiting Pedro's push/PR authorization.** This 012 copy of `agent-backlog-state.md` is cumulative latest. Merge-coupling: 010/011 coverage credits 009's ratchet (bump floors after they land).
- **Main worktree dirty = accidental deletions, untouched.** Recommend: `git restore .gitignore .specify e2e specs .claude/commands`.
- **Build env:** pnpm `~/.local/share/pnpm` (export PATH for husky too); cargo/Tauri need the nix-shell (`pkg-config openssl alsa-lib gnumake gtk3 webkitgtk_4_1 libayatana-appindicator librsvg speechd`); `generate_context!`/build need a `dist/` stub. Release build ≈ 9 min (LTO). Bundle toolchain absent.
- **Loop:** hourly cron `7 * * * *` (job `473ce7f0`, session-only). Re-running `/loop 60m /lectrice-forward` does NOT duplicate (kept the existing job).
- **Open worktrees to clean post-merge:** `-008-…`, `-009-…`, `-010-…`, `-011-…`, `-012-…`.

### Next command
`/loop 60m /lectrice-forward` (scheduled).
