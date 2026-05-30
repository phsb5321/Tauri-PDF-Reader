# Lectrice — Agent Backlog State

> Durable handoff for the `/loop` / lectrice-forward workflow. Latest iteration first.

## Iteration — 2026-05-30 #3 (Spec 010: Word-Timing Tests + UTF-16 fix)

- **Branch:** `010-word-timing-tests` (off `origin/main` 7c5de09). Commit pending below.
- **Slice:** P1 — harden the karaoke differentiator's core algorithm.
- **Finding:** word-level karaoke is ALREADY built + wired (`useTtsWordHighlight`→
  `AiPlaybackBar`; `TtsWordHighlight`→`PdfViewer`/`TextLayer`; backend
  `text_to_speech_with_timestamps`→`chars_to_words`). The roadmap's "word-level
  highlighting" was stale (already done). The gap: `chars_to_words` had ZERO tests.
- **Change:** +8 fixture unit tests for `chars_to_words`. The tests + Codex
  exposed a real bug → **fixed**: offsets were UTF-8 **bytes**
  (`char_str.len()`) but the consumer `createWordRange` uses UTF-16 code units
  → word highlight broke for non-ASCII (umlauts/accents/CJK). Fix:
  `char_index += char_str.encode_utf16().count()`. ASCII byte-identical (no
  regression); non-ASCII corrected.
- **Verified:** `cargo fmt --check`, `cargo test chars_to_words` (8 pass),
  `cargo clippy --all-targets -- -D warnings` clean. **Codex 2 rounds → Pass**
  (`.claude/reviews/010-word-timing.md`).
- **Residual:** end-to-end non-ASCII DOM highlight is GUI-gated (offset math +
  consumer unit verified statically). GUI smoke follow-up.
- **Next slice:** P0#5 bundle/profile smoke (run `pnpm tauri build` or document
  blocker), OR S2 persisted-scope + library-reopen UI wiring (needs a UX
  decision — better with Pedro), OR raise coverage floors (009 follow-up).

## Iteration — 2026-05-30 #2 (Spec 009: Coverage Gate) — branch `009-coverage-gate`, commit `5c98fc3`

- `vitest.config.ts` thresholds flat 80 → ratcheted floors (lines/stmts 42, functions 53, branches 80) — explicit, documented regression gate (`docs/coverage-budget.md`), NOT silent lowering. CI `Coverage check` now green (was red every run).
- Measured: lines/stmts 42.44, functions 53.82, branches 87.96 (29 files / 486 tests). Verified rc=0. Codex PASS.

## Iteration — 2026-05-30 #1 (Spec 008: Security + Housekeeping) — branch `008-security-housekeeping`, commit `93065ac`

- Asset scope `["**/*"]→[]`; fs scope `["**/*"]→["$APPLOCALDATA/**"]`.
- Backend `validate_pdf_path` (canonicalize + regular `.pdf` + fstat-on-open) gating `compute_file_hash` + `library_check_file_exists`; blocks `/dev/zero` DoS, `/etc/passwd` oracle, symlink masquerade, SQL existence oracle. 8 tests. Codex 4 rounds → Pass.
- Cargo.toml authors/description; CLAUDE.md rodio 0.21→0.20.
- Follow-ups: S2 persisted-scope (when reopen wired); S-provenance (backend hashes any readable `.pdf` named over IPC); WebView raw-SQL surface; build-smoke.

## Standing context (all iterations)

- **Branches independent off `origin/main` (7c5de09), unmerged, awaiting Pedro's push/PR authorization.** Each carries its own `docs/agent-backlog-state.md` (this 010 copy is the cumulative latest); reconcile at merge. Loop workflow files live on 008.
- **Main worktree dirty state = accidental deletions, untouched.** Recommend Pedro: `git restore .gitignore .specify e2e specs .claude/commands` (all in HEAD; no data loss).
- **Build env:** pnpm at `~/.local/share/pnpm` (export PATH for git hooks too — husky pre-commit needs it); cargo/Tauri need `nix-shell -p pkg-config openssl alsa-lib gnumake gtk3 webkitgtk_4_1 libayatana-appindicator librsvg speechd`; `generate_context!`/`cargo test` need a `dist/` (stub `dist/index.html`, gitignored).
- **Loop:** hourly cron `7 * * * *` (job 473ce7f0, session-only) runs one forward-loop iteration.
- **Open worktrees to clean post-merge:** `-008-security-housekeeping`, `-009-coverage-gate`, `-010-word-timing-tests`.

### Next command
`/loop 60m /lectrice-forward` (scheduled) — next tick: P0#5 bundle smoke or S2 reopen wiring.
