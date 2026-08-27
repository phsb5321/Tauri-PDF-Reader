# Tasks: Reproducible macOS Flake Delivery

**Feature**: `190-macos-flake` | **Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

Dependency ordered. Workflow tasks are deliberately isolated because GitHub
Actions changes require Pedro's merge.

## Slice A — package and real-Mac verification

- [x] T001 — Add `nix/lectrice-darwin.nix` with the native Tauri hook, locked Cargo dependencies, fixed pnpm store, arm64-only metadata, app output, and CLI symlink. (FR-001–FR-004)
- [x] T002 — Extend `flake.nix` to expose Darwin packages without evaluating Linux-only GTK/WebKit or changing existing Linux outputs. (FR-001, FR-004)
- [x] T003 — Add `scripts/verify-macos-flake.sh` for static plist/version/arm64 checks plus opt-in process/window launch observation and a malformed-output negative control. (FR-005)
- [x] T004 — Add `scripts/manage-macos-flake.sh` for dedicated-profile install, update, status, rollback, and stable user Applications symlink. (FR-008–FR-011)
- [x] T005 — Document install, update, rollback, manual-app migration, and unsigned personal-channel boundary in `docs/macos-nix.md`, README, and known limitations. (FR-010–FR-012)
- [ ] T006 — Run Linux evaluation/regression checks and the full `aarch64-darwin` build on `Mac.Pro`; retain the exact output/identity/launch receipt outside scratch storage. (SC-001–SC-003)
- [ ] T007 — Run a different-family adversarial review, repair BLOCKER/MAJOR findings, push, open a safe-class PR, poll CI, squash-merge, and verify `state=MERGED`.

## Slice B — arm64 macOS CI (Pedro-gated workflow PR)

- [ ] T008 — Branch from merged Slice A and add `.github/workflows/macos-flake.yml`: protected-main-only read-only build on the repo-scoped M5, then checkout-free vm103 fast-forward promotion to `macos-green`. (FR-006, FR-007)
- [ ] T009 — Add malformed-bundle and no-force/no-PR/no-checkout workflow controls without exposing signing or application credentials. (FR-005–FR-007)
- [ ] T010 — Open the workflow PR, obtain green CI and different-family review, then mark `[pending] Pedro: merge workflow PR`; never self-merge. (SC-004)

## Slice C — Mac continuous update and rollback

- [ ] T011 — After Slice B is on base/required, install the merged flake into the dedicated Mac profile, migrate only the stale manual app copies to dated backups, and establish `~/Applications/Lectrice.app`. (FR-008, FR-011)
- [ ] T012 — Add a declarative user LaunchAgent in the NixOS repository that runs the profile updater on a bounded schedule and records source/output/generation without document content. (FR-008–FR-012)
- [ ] T013 — Prove an invalid revision leaves generation and target unchanged, then prove valid upgrade and one-generation rollback; retain the receipt. (SC-005, SC-006)
- [ ] T014 — Update issue #190, the fleet ledger, and project backlog state with exact merged heads, Mac receipt, pending signing boundary, and one-line reversal paths.
