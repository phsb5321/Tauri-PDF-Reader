# Lectrice — Agent Backlog State

> Durable handoff for the `/loop` / lectrice-forward workflow. Update every iteration.

## Iteration — 2026-05-30 (Spec 008: Security + Housekeeping)

### Branch / head
- Worktree: `../tauri-pdf-reader-008-security-housekeeping`
- Branch: `008-security-housekeeping` (off `origin/main` @ 7c5de09, "rebrand to Lectrice; repair backend CI" #5)
- Main worktree left untouched (still on local `main` 6ccf946, dirty — see below).

### Dirty worktree handling (main worktree, NOT this branch)
The main worktree's "±25" state is NOT user work — it is filesystem deletions of
committed files (all restorable from HEAD): the 9 `.claude/commands/speckit.*.md`,
`.gitignore`, `.specify/templates/spec-template.md`, `e2e/critical-loop.spec.ts`,
and the `spec.md` of specs 001–007; plus untracked generated dirs (`coverage/`,
`src-tauri/gen/`, `.husky/_/`) that re-appeared because the deleted `.gitignore`
stopped ignoring them, and `.opencode/` (competing-agent scaffolding).
**Per hard constraint: NOT touched.** Work was isolated in a fresh worktree off
clean `origin/main`. **Recommendation for Pedro:** in the main worktree,
`git restore .gitignore .specify e2e specs .claude/commands` to recover the
accidental deletions (everything is in HEAD; no data loss).

### Selected slice
P0 housekeeping metadata + Tauri security scope tightening + backend file-ingest hardening.

### Files changed (this branch)
- `src-tauri/tauri.conf.json` — `assetProtocol.scope ["**/*"] -> []` (asset protocol unused; no `convertFileSrc`).
- `src-tauri/capabilities/default.json` — `fs:scope ["**/*"] -> ["$APPLOCALDATA/**"]`; description "PDF Reader" -> "Lectrice".
- `src-tauri/src/commands/library/db.rs` — `validate_pdf_path` (canonicalize + regular `.pdf`); `compute_file_hash` opens canonical + fstat-rechecks the open fd; 8 unit tests.
- `src-tauri/src/commands/library/mod.rs` — `library_check_file_exists` gated through `validate_pdf_path`.
- `src-tauri/Cargo.toml` — `authors ["VoxPage"] -> ["Pedro H S Balbino"]`; description -> Lectrice-specific.
- `CLAUDE.md` — `rodio 0.21+ -> 0.20` (matches Cargo.toml).
- New: `.claude/skills/lectrice-forward-loop/SKILL.md`, `.claude/commands/lectrice-forward.md`, `.claude/loop.md`, `.claude/reviews/008-*.md`, `specs/008-security-housekeeping/*`, this file.

### Spec Kit artifacts
`specs/008-security-housekeeping/{spec,plan,tasks,checklist,risk-register,rollback}.md` (authored manually; speckit plugin + `.specify/scripts` available).

### Commands discovered
- Frontend: `pnpm` at `~/.local/share/pnpm/pnpm`; `pnpm lint` / `lint:boundaries` / `typecheck` / `test` / `test:run` / `test:coverage` / `test:arch` / `verify` (./scripts/verify.sh).
- Backend (needs nix-shell): `nix-shell -p pkg-config openssl alsa-lib gnumake gtk3 webkitgtk_4_1 libayatana-appindicator librsvg speechd --run '...'`; `cargo check` / `cargo fmt --check` / `cargo test --features test-mocks -j 1`.
- `generate_context!` requires a `dist/` to exist — create a stub `dist/index.html` (gitignored) to `cargo check` without a frontend build.
- codex 0.133, gh 2.92, node v22, cargo 1.95.

### Verification results
- JSON valid (tauri.conf, capabilities). Metadata greps clean (no `VoxPage`, no `rodio 0.21`, no `**/*` in scopes).
- `cargo check` rc=0 (validates capability JSON + Cargo.toml via `generate_context!`, with dist stub).
- `cargo fmt --check` + `cargo clippy --all-targets --features test-mocks -- -D warnings` clean. `cargo test commands::library::db` -> **8 passed**.
- Frontend lint/typecheck: n/a — zero TS source changed (config/metadata/docs); node_modules absent in fresh worktree.

### Security impact
- Removed whole-disk **asset** protocol scope (`[]`) — protocol was dead config.
- Removed whole-disk **fs** scope -> `$APPLOCALDATA/**` (live opens ride the dialog runtime grant; `LibraryView` is unmounted so no reopen path needs broad scope).
- Hardened the **backend file-ingest** surface (custom commands bypass fs scope): `validate_pdf_path` blocks `/dev/zero` (DoS), `/etc/passwd` (hash oracle), symlink masquerade, devices/dirs; fstat-on-open closes the read-path TOCTOU; `library_check_file_exists` no longer an existence oracle.

### Coverage impact
None — threshold left at 80% (vitest.config.ts). Honest baseline is far lower
(snapshot ~42%); the ratchet-vs-write-tests decision is a dedicated P0#4 slice,
not silently changed here.

### Codex adversarial review
4 rounds, `.claude/reviews/008-security-housekeeping-{round1,rounds2-4}.md`.
Round 1 BLOCKER (backend arbitrary read) + rounds 2–3 MAJORs (symlink, SQL
oracle, TOCTOU) all fixed. **Round 4 verdict: Pass.** 0 unresolved BLOCKER/MAJOR.

### Remaining risks / follow-ups
- **S2 — persisted-scope:** add `tauri-plugin-persisted-scope` (after `tauri_plugin_fs::init()`, lib.rs:252) when/if library-click reopen is wired; lets static fs scope stay at `$APPLOCALDATA`. Needs a GUI build + restart-reopen test.
- **S-provenance:** backend still hashes any readable `.pdf` named over IPC (no picker-provenance). Bounded residual; full fix routes reads through fs-plugin scope or verifies provenance. Tracked (R11).
- **WebView SQL surface:** consider dropping raw `sql:allow-execute` from the WebView capability in favor of typed commands.
- **Build-smoke:** full `pnpm tauri build` not run (GUI/env gated) — run before any release.
- **Coverage (P0#4):** decide ratchet vs. tests.
- **Optional:** disable asset protocol entirely (`enable:false`) + trim CSP `asset:` (cosmetic); delete dead `pdf-storage-service.ts` or wire it.

### Next slice
Coverage gate decision (P0#4) OR persisted-scope+reopen wiring (S2). Then P1
word-level karaoke highlighting + ElevenLabs stream-with-timestamps.

### Next command
`/loop 25m`
