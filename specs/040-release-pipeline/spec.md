# Feature Specification: Tag-Triggered Linux Release Pipeline

**Feature Branch**: `040-release-pipeline`
**Created**: 2026-07-21
**Status**: Draft
**Input**: User description: "Tier 3 release pipeline — a `.github/workflows/release.yml` that on a `v*` tag builds the Tauri bundle (Linux .AppImage + .deb) and attaches artifacts to a GitHub Release. Run on the self-hosted vm103 runner. CI-config-only + docs; no app source / capability / fs-scope changes."

## Context (non-normative)

Lectrice ships as a Tauri 2.x desktop app. `src-tauri/tauri.conf.json` already
has `bundle.active: true`, `bundle.targets: "all"`, `productName: "Lectrice"`,
`version: "0.1.0"`. A `v0.1.0` git tag and a matching hand-made GitHub Release
already exist — but **nothing produces the installable artifacts automatically**.
`.github/workflows/` contains only `ci.yml` (lint/typecheck/test/build) and
`codeql.yml` (static analysis). There is no release/tag workflow, so cutting a
new version does not yield a `.AppImage` or `.deb` for users to download.

This feature adds the missing automation: a tag-triggered workflow that builds
the Linux bundles and publishes them to the tag's GitHub Release.

**Scope**: CI/CD configuration (`.github/workflows/release.yml`) + docs only.
Out of scope: any change to app source, Tauri capabilities, fs/asset scopes,
`tauri.conf.json` bundle settings (targets are restricted via the build
command, not by editing the committed config), Windows/macOS targets (Linux
only — the project's primary/CI platform), code-signing, and the app updater.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Cut a release by pushing a version tag (Priority: P1)

A maintainer finishes a release-worthy state on `main`, bumps the version, and
pushes a `v*` git tag (e.g. `v0.2.0`). Without any further manual step, CI
builds the Linux bundles and attaches a `.AppImage` and a `.deb` to a GitHub
Release for that tag. A user visiting the Releases page can download and install
Lectrice.

**Why this priority**: This is the entire feature. It is the MVP and the only
user story — it delivers the complete value (automated, reproducible release
artifacts) on its own.

**Independent Test**: Push a throwaway `v0.1.0-rc-test` tag on a branch; confirm
the release workflow run goes GREEN and both artifacts (`.AppImage`, `.deb`) are
attached to the auto-created release; then delete the test tag + release.

**Acceptance Scenarios**:

1. **Given** the workflow is on the default branch, **When** a `v*` tag is
   pushed, **Then** the `Release` workflow triggers exactly one run on the
   self-hosted vm103 runner.
2. **Given** a triggered release run, **When** the build completes, **Then**
   `tauri build` produces a Linux `.AppImage` and a `.deb` bundle.
3. **Given** a successful build, **When** the run finishes, **Then** a GitHub
   Release for the tag exists (auto-created if absent) with both bundles
   attached as downloadable assets.
4. **Given** a non-`v*` push (branch commit, PR, or a tag like `foo`), **When**
   it lands, **Then** the release workflow does NOT trigger.

### Edge Cases

- **AppImage FUSE trap**: the self-hosted runner lacks the FUSE kernel module,
  so `linuxdeploy` (an AppImage itself) cannot self-mount → build fails with
  "failed to run linuxdeploy". Mitigated by `APPIMAGE_EXTRACT_AND_RUN=1`.
- **`strip` / `.relr.dyn` incompatibility** on the modern toolchain →
  `NO_STRIP=true`.
- **Release already exists for the tag** (e.g. the pre-existing `v0.1.0`
  release): the action uploads assets to the existing release rather than
  failing — but a re-run must not silently clobber a real published release
  (verification uses a throwaway `-rc-test` tag, never a real version).
- **Two `v*` tags pushed close together**: a `concurrency` group serializes
  them; an in-flight release upload is never cancelled (`cancel-in-progress:
  false`).
- **`.deb` tooling absent**: bundling needs `dpkg-deb` + `fakeroot`; the apt
  install step provides them idempotently.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The repository MUST contain `.github/workflows/release.yml`.
- **FR-002**: The workflow MUST trigger ONLY on pushes of tags matching `v*`
  (`on: push: tags: ['v*']`) and MUST NOT trigger on branch pushes or PRs.
- **FR-003**: The workflow MUST run on the self-hosted runner
  `[self-hosted, Linux, X64, vm103]` (GitHub-hosted runners are unavailable due
  to the phsb5321 billing lock — see backlog env-lessons).
- **FR-004**: The workflow MUST run `tauri build` producing a Linux `.AppImage`
  AND a `.deb`, restricting output to those two targets via the build command
  (`--bundles appimage,deb`) WITHOUT editing `tauri.conf.json`.
- **FR-005**: The workflow MUST create (or reuse) a GitHub Release for the
  pushed tag and upload both bundles as assets, using the built-in
  `GITHUB_TOKEN`.
- **FR-006**: The release job MUST declare least-privilege permissions: a
  deny-all (`permissions: {}`) at workflow scope and `contents: write` at job
  scope (the minimum to create a release + upload assets), mirroring the
  `codeql.yml` convention.
- **FR-007**: The workflow MUST NOT modify app source, Tauri capabilities,
  fs/asset scopes, or `bundle.*` in `tauri.conf.json` (no scope widening).
- **FR-008**: The workflow MUST install the frontend dependencies (`pnpm
  install`) before the build, because tauri-action runs `beforeBuildCommand`
  (`pnpm build`) but does not populate `node_modules` itself.
- **FR-009**: The AppImage FUSE + strip workarounds (`APPIMAGE_EXTRACT_AND_RUN=1`,
  `NO_STRIP=true`) MUST be set so the build succeeds on the self-hosted runner.
- **FR-010**: The token-holding publish action (`tauri-apps/tauri-action`) MUST
  be pinned to a commit SHA with a version comment (supply-chain: the action
  that receives `GITHUB_TOKEN` + publishes is the highest-risk step).

### Key Entities

- **Release workflow** (`release.yml`): the tag-triggered GitHub Actions
  pipeline. Relationships: mirrors `ci.yml`'s self-hosted runner + system-dep +
  cache setup; mirrors `codeql.yml`'s deny-all permissions convention.
- **GitHub Release**: the per-tag published artifact set (name, body, assets).
- **Bundle artifacts**: the `.AppImage` and `.deb` produced by `tauri build`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Pushing a throwaway `v0.1.0-rc-test` tag results in a release
  workflow run that reaches conclusion `success` (verified via `gh run list`).
- **SC-002**: The auto-created release for that tag has exactly two downloadable
  assets whose names end in `.AppImage` and `.deb` (verified via `gh release
  view`).
- **SC-003**: The diff for this feature touches only `.github/workflows/`,
  `specs/040-release-pipeline/`, and `docs/` — zero changes to `src/`,
  `src-tauri/src/`, `src-tauri/tauri.conf.json`, or `src-tauri/capabilities/`
  (verified via `git diff --stat`).
- **SC-004**: `actionlint .github/workflows/release.yml` reports no errors.
- **SC-005**: A non-`v*` push (the feature branch's own commits) does NOT
  trigger the release workflow (verified: no release run appears for the branch
  in `gh run list`).
