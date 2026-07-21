# Implementation Plan: Tag-Triggered Linux Release Pipeline

**Branch**: `040-release-pipeline` | **Date**: 2026-07-21 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `specs/040-release-pipeline/spec.md`

## Summary

Add `.github/workflows/release.yml` that, on a `v*` tag push, builds Lectrice's
Linux bundles (`.AppImage` + `.deb`) via `tauri-apps/tauri-action` and publishes
them to the tag's GitHub Release. Runs on the self-hosted `vm103` runner,
reusing `ci.yml`'s system-dep + pnpm/node/Rust + cargo-cache setup. The build
targets are restricted with `--bundles appimage,deb` (build-command flag, not a
config edit), so `tauri.conf.json` is untouched. Least-privilege permissions
mirror `codeql.yml`. Verified end-to-end by pushing a throwaway `v0.1.0-rc-test`
tag and confirming a GREEN run with two attached assets, then cleaning up.

## Technical Context

**Language/Version**: GitHub Actions YAML (workflow config); builds Rust 2021 +
TypeScript 5.6 / Vite via the Tauri CLI.
**Primary Dependencies**: `tauri-apps/tauri-action@v1.0.0` (SHA-pinned
`1deb371b0cd8bd54025b384f1cd735e725c4060f`); `actions/checkout`,
`actions/setup-node`, `pnpm/action-setup`, `dtolnay/rust-toolchain`,
`actions/cache` (floating tags, matching `ci.yml`).
**Storage**: N/A (artifacts uploaded to the GitHub Release).
**Testing**: `actionlint` (static workflow lint) + a live throwaway-tag dry run
(`gh run list` / `gh release view` as the oracle).
**Target Platform**: Linux x86_64 desktop bundles (AppImage + deb).
**Project Type**: single desktop app (Tauri) — this feature is CI config only.
**Performance Goals**: N/A (release cadence, not runtime). Build ≈ CI backend
build time (~release build ≈ 9 min per backlog) + bundling.
**Constraints**: self-hosted runner only (GH-hosted billing-locked); no scope
widening; diff limited to `.github/workflows/` + `specs/` + `docs/`.
**Scale/Scope**: one workflow file, one job, ~10 steps.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

The project constitution centers on **Verification Discipline** (every
behavioral claim proved by a runnable assertion, never a human glance) and
**Merge Ownership** (done = merged; escalate genuinely-gated surfaces).

- **Verification**: the user-visible claim ("a `v*` tag yields a release with
  `.AppImage` + `.deb`") is mechanized by an actual tag push + `gh run list`
  (conclusion=success) + `gh release view` (two assets). Static shape is
  asserted by `actionlint`. No pixels/human-glance oracle. **PASS.**
- **No scope widening**: SC-003 asserts the diff excludes `src/`,
  `src-tauri/src/`, `tauri.conf.json`, `capabilities/`. **PASS.**
- **Merge Ownership**: this touches `.github/workflows/` — a genuinely-gated
  surface. Plan: open the PR green + adversarially reviewed, then **escalate the
  merge to Pedro** rather than self-merging the workflow change. **PASS (by
  escalation).**
- **Least privilege**: deny-all workflow scope + `contents: write` job scope,
  per `codeql.yml`. **PASS.**

No violations → Complexity Tracking is empty.

## Project Structure

### Documentation (this feature)

```text
specs/040-release-pipeline/
├── plan.md              # This file
├── spec.md              # Feature spec (done)
└── tasks.md             # Task breakdown (done)
```

No `research.md` / `data-model.md` / `contracts/` — the research (tauri-action
version, FUSE workaround, permissions, bundle flag) is captured inline in this
plan's Approach section; there is no data model or API contract for a CI file.

### Source Code (repository root)

```text
.github/workflows/
├── ci.yml               # existing — mirror its runner + dep + cache setup
├── codeql.yml           # existing — mirror its deny-all permissions convention
└── release.yml          # NEW — this feature

docs/
└── agent-backlog-state.md   # updated: new Iteration closing the release item
```

**Structure Decision**: Single desktop app; the only code artifact is
`.github/workflows/release.yml`. No source directories change.

## Approach (research captured inline)

1. **Trigger**: `on: push: tags: ['v*']`. Tag name read as `${{ github.ref_name }}`.
   Deny-all `permissions: {}` at top; `concurrency: group release-${{ github.ref }},
   cancel-in-progress: false`.
2. **Runner**: `[self-hosted, Linux, X64, vm103]` (same label as `ci.yml`).
3. **Setup steps** (mirror `ci.yml` backend job): apt install
   (`libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf
   libspeechd-dev libasound2-dev libssl-dev pkg-config clang libclang-dev`) plus
   `fakeroot dpkg file` for `.deb`/AppImage bundling; `setup-node@20`;
   `pnpm/action-setup@v4 version:10` (package.json has no `packageManager`);
   `dtolnay/rust-toolchain@stable`; cargo cache.
4. **Frontend deps**: `pnpm install` (tauri-action does NOT populate
   `node_modules`; it only runs `beforeBuildCommand: "pnpm build"`).
5. **Build + publish**: `tauri-apps/tauri-action` SHA-pinned to
   `1deb371b...` (= `action-v1.0.0`, non-prerelease, verified via the releases
   API). Inputs: `tagName: ${{ github.ref_name }}`, `releaseName`,
   `releaseBody`, `releaseDraft: false`, `prerelease: false`,
   `args: --bundles appimage,deb`. `env: GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}`.
   The action auto-creates the release and uploads the bundles — no separate
   upload step.
6. **FUSE/strip workarounds**: job-level `env: APPIMAGE_EXTRACT_AND_RUN: '1'`,
   `NO_STRIP: 'true'` (self-hosted lacks the FUSE kernel module for
   `linuxdeploy`; strip trips on `.relr.dyn`).
7. **SHA-pinning policy**: pin ONLY `tauri-action` (the step that holds the
   token and publishes — the supply-chain-critical one), matching how
   `codeql.yml` pins its security-sensitive actions; float the setup helpers
   exactly as `ci.yml` already does (consistency with the repo's other
   self-hosted workflow).

## Complexity Tracking

> No Constitution Check violations — section intentionally empty.
