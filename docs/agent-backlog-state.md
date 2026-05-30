# Lectrice — Agent Backlog State

> Durable handoff for the `/loop` / lectrice-forward workflow. Latest iteration first.

## Iteration — 2026-05-30 #4 (Spec 011: TTS Highlight Store Tests)

- **Branch:** `011-highlight-store-tests` (off `origin/main` 7c5de09). Commit pending below.
- **Slice:** raise coverage of a 0%-covered store (009 follow-through) — `tts-highlight-store` (karaoke state machine, pairs with 010's algorithm).
- **Change:** +`src/__tests__/unit/tts-highlight-store.test.ts` (15 tests: actions, guards, selectors). Test-only; no `vitest.config.ts` change (009 owns the gate).
- **Verified:** `pnpm exec vitest run tts-highlight-store` 15 pass; `pnpm typecheck` rc=0. Codex 2 rounds → Sound (r1 MAJOR — weak resume assertion — fixed by stubbing `performance.now` to assert the `now - pausedAtTime` re-anchor; added pause-guard + subscription-based no-op tests + `afterEach` mock restore). `.claude/reviews/011-highlight-store.md`.
- **Next slice:** more 0%-covered stores (settings-store, tts-store, library-store) to keep raising coverage; OR P0#5 bundle/profile smoke (`cargo build --release` headless-verifiable; full bundle GUI-gated); OR S2 persisted-scope + library-reopen UI (needs a UX decision — surface to Pedro).

## Iteration — 2026-05-30 #3 (Spec 010: Word-Timing Tests + UTF-16 fix) — branch `010-word-timing-tests`, commit `8ba95b1`

- Found word-karaoke already built+wired (roadmap stale). `chars_to_words` had 0 tests → +8 tests. Tests+Codex exposed a real bug: offsets were UTF-8 bytes but the frontend consumer uses UTF-16 → non-ASCII highlight broke. **Fixed:** `char_index += char_str.encode_utf16().count()` (ASCII unchanged). Codex 2 rounds → Pass. Residual: GUI smoke for non-ASCII highlight.

## Iteration — 2026-05-30 #2 (Spec 009: Coverage Gate) — branch `009-coverage-gate`, commit `5c98fc3`

- `vitest.config.ts` flat 80 → ratcheted floors (lines/stmts 42, functions 53, branches 80) — explicit documented regression gate (`docs/coverage-budget.md`), CI now green. Measured 42.44/42.44/53.82/87.96 (486 tests). Codex PASS. **Follow-up: raise floors as tests land (011 adds store coverage — bump floors when 009 merges).**

## Iteration — 2026-05-30 #1 (Spec 008: Security + Housekeeping) — branch `008-security-housekeeping`, commit `93065ac`

- Asset scope `["**/*"]→[]`; fs scope `["**/*"]→["$APPLOCALDATA/**"]`. Backend `validate_pdf_path` (canonicalize + regular `.pdf` + fstat) gating `compute_file_hash` + `library_check_file_exists`; blocks `/dev/zero` DoS, `/etc/passwd` oracle, symlink masquerade, SQL existence oracle. 8 tests. Cargo.toml authors/desc; CLAUDE.md rodio 0.21→0.20. Codex 4 rounds → Pass.
- Follow-ups: S2 persisted-scope (when reopen wired); S-provenance; WebView raw-SQL; build-smoke.

## Standing context (all iterations)

- **4 branches independent off `origin/main` (7c5de09), unmerged, awaiting Pedro's push/PR authorization.** Each carries its own `docs/agent-backlog-state.md` (this 011 copy is cumulative latest); reconcile at merge. Merge-coupling: 011's store coverage credits 009's ratchet — bump 009 floors after both land. Loop workflow files live on 008.
- **Main worktree dirty state = accidental deletions, untouched.** Recommend Pedro: `git restore .gitignore .specify e2e specs .claude/commands` (all in HEAD; no data loss).
- **Build env:** pnpm at `~/.local/share/pnpm` (export PATH for git hooks too — husky pre-commit needs pnpm+node_modules; absent in a fresh worktree until `pnpm install`); cargo/Tauri need `nix-shell -p pkg-config openssl alsa-lib gnumake gtk3 webkitgtk_4_1 libayatana-appindicator librsvg speechd`; `generate_context!`/`cargo test` need a `dist/` (stub `dist/index.html`, gitignored).
- **Loop:** hourly cron `7 * * * *` (job 473ce7f0, session-only) runs one forward-loop iteration.
- **Open worktrees to clean post-merge:** `-008-…`, `-009-…`, `-010-…`, `-011-…`.

### Next command

`/loop 60m /lectrice-forward` (scheduled).
