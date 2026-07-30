# Tasks: Tag-Triggered Linux Release Pipeline

**Feature**: `040-release-pipeline` | **Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

Dependency-ordered. Single MVP slice (User Story 1, P1). `[X]` = done.

## Phase 1 — Author the workflow

- [X] **T001** — Create `.github/workflows/release.yml`: `on: push: tags: ['v*']`,
  deny-all `permissions: {}`, `concurrency` group (no cancel-in-progress), job on
  `[self-hosted, Linux, X64, vm103]` with `contents: write` + FUSE/strip env.
  (FR-001, FR-002, FR-003, FR-006, FR-009)
- [X] **T002** — Add the setup steps mirroring `ci.yml`: apt system deps (+
  `fakeroot dpkg file`), node 20, pnpm 10, Rust stable, cargo cache, and
  `pnpm install` before the build. (FR-008)
- [X] **T003** — Add the `tauri-apps/tauri-action` publish step, SHA-pinned to
  `1deb371b0cd8bd54025b384f1cd735e725c4060f` (v1.0.0), with
  `tagName/releaseName/releaseBody`, `args: --bundles appimage,deb`, and
  `GITHUB_TOKEN`. (FR-004, FR-005, FR-010)

## Phase 2 — Static verification

- [X] **T004** — `actionlint .github/workflows/release.yml` → no errors. (SC-004)
- [X] **T005** — `git diff --stat` confirms the diff touches only
  `.github/workflows/`, `specs/040-release-pipeline/`, `docs/` — no `src/`,
  `src-tauri/src/`, `tauri.conf.json`, `capabilities/`. (SC-003, FR-007)

## Phase 3 — Live dry-run verification (the real oracle)

- [X] **T006** — Push branch, then push a throwaway `v0.1.0-rc-test` tag from the
  branch; poll `gh run list --workflow=Release` until the run reaches
  conclusion `success`. (SC-001)
- [X] **T007** — `gh release view v0.1.0-rc-test` confirms exactly two assets
  ending in `.AppImage` and `.deb`. (SC-002)
- [X] **T008** — Confirm no release run fired for the branch's ordinary commits
  (only the tag triggered it). (SC-005)
- [X] **T009** — Clean up: `gh release delete v0.1.0-rc-test` + delete the remote
  and local `v0.1.0-rc-test` tag. Leave no throwaway artifacts.

## Phase 4 — Review, docs, ship

- [X] **T010** — Adversarial cross-family gate on the diff (codex first;
  usage-limited until 25/07 → `glm-review`); address BLOCKER/MAJOR findings.
- [X] **T011** — Update `docs/agent-backlog-state.md` with a new Iteration
  closing the release-pipeline Tier-3 item.
- [X] **T012** — Open PR (green CI + review-clean). Because this touches
  `.github/workflows/`, **escalate the merge to Pedro** (`[pending] Pedro:
  merge #NN`) rather than self-merging.
