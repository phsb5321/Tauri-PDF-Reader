# Tasks 008 — Security + Housekeeping

Dependency-ordered. `[x]` = done with evidence; `[~]` = done, verification pending.

## Setup
- [x] T001 Create feature worktree from `origin/main` (7c5de09); dirty main worktree untouched.
- [x] T002 Verify open/reopen flow + scope usage (no `convertFileSrc`; plugin-fs `readFile` path; dead storage service; `LibraryView` unmounted; library add reads original path in native Rust).
- [x] T003 Research Tauri v2 dialog scope grant + persisted-scope ordering (HIGH confidence).

## Workflow infra
- [x] T010-T012 `.claude/skills/lectrice-forward-loop/SKILL.md`, `.claude/commands/lectrice-forward.md`, `.claude/loop.md`.

## Spec Kit
- [x] T020 `specs/008-security-housekeeping/{spec,plan,tasks,checklist,risk-register,rollback}.md`.

## Implementation
- [x] T030 C1: `tauri.conf.json` `assetProtocol.scope ["**/*"] -> []`.
- [x] T031 C2: `capabilities/default.json` `fs:scope` `["**/*"] -> ["$APPLOCALDATA/**"]` (+ description rename).
- [x] T032 C3: `Cargo.toml` authors + description.
- [x] T033 C4: `CLAUDE.md` rodio `0.21+ -> 0.20` (both lines).
- [x] T034 C5: `validate_pdf_path` (canonicalize + regular `.pdf`) gating `compute_file_hash` (db.rs) AND `library_check_file_exists` (mod.rs) + 8 unit tests. Closes Codex BLOCKER + round-2 MAJORs (symlink masquerade, SQL existence oracle).

## Verification
- [x] T040 Metadata greps: no `VoxPage`, no `rodio 0.21`, no `**/*` in tauri.conf/capabilities.
- [x] T041 JSON validity (`tauri.conf.json`, `capabilities/default.json`).
- [x] T043 `cargo check` passes with dist stub (validates capability JSON + Cargo.toml; rc=0).
- [~] T044 `cargo fmt --check` (fixed line-break) + targeted `cargo test commands::library::db` (running).
- [ ] T045 Re-run Codex adversarial review -> `.claude/reviews/008-*.md`; confirm BLOCKER resolved.
- [n/a] Frontend lint/typecheck — no TS source changed (config/metadata/docs only); node_modules absent in fresh worktree.
- [defer] `pnpm tauri build` full bundle — GUI/build-env gated; `cargo check` + dist stub cover config validity. Tracked for a build-smoke slice.

## Close-out
- [ ] T050 Update `docs/agent-backlog-state.md`.
- [ ] T051 Commit on `008-security-housekeeping` (no push without authorization).
- [x] T052 S2 (persisted-scope) + symlink + existence-oracle residuals captured in spec/plan/risk-register.
