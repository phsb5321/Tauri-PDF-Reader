# Tasks 012 — Release / Bundle Smoke (P0#5)

- [x] T001 Worktree `012-release-smoke` off origin/main (7c5de09) + dist stub.
- [x] T002 Inspect `[profile.release]`, `bundle` config, WEBKIT env, bundle tooling.
- [x] T003 `cargo build --release` (default features) — PASS rc=0, 15MB stripped binary, 9m13s. 1 benign release-only warning (`specta_builder`, debug-export-only; release IPC via `generate_handler!` intact).
- [x] T004 Determine bundle feasibility: `linuxdeploy`/`appimagetool`/`cargo-tauri` ABSENT → full `tauri build` blocked; documented + recommendation (narrow targets or provision toolchain).
- [x] T005 Evaluate research WEBKIT_DISABLE_DMABUF_RENDERER suggestion → inapplicable (COMPOSITING_MODE is the correct full-software-render in the hw-accel-disable path). No change.
- [x] T006 Codex review of findings/spec -> `.claude/reviews/012-release-smoke.md` (valid; 2 wording MINORs fixed; no BLOCKER/MAJOR against the slice).
- [ ] T007 Update `docs/agent-backlog-state.md`.
- [ ] T008 Commit on `012-release-smoke` (docs-only; no push without authorization).
