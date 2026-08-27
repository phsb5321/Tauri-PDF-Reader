# Feature Specification: Reproducible macOS Flake Delivery

**Feature Branch**: `190-macos-flake`
**Created**: 2026-08-26
**Status**: In progress
**Input**: User request: “create a flake for Lectrice so I can have it on the MacBook; I need CI/CD so I can always get the latest version.”

## Context (non-normative)

The repository flake currently exposes only Linux development tooling. Lectrice
has been built and launched manually on the M5 MacBook, but the two app copies
are stale, hand-copied, and outside a reproducible update or rollback path.

“Latest” in this feature means the newest revision of the protected `main`
branch that passes the macOS package gate and is fast-forward promoted to
`macos-green`. It does not mean an unreviewed branch or a build that failed
after merge. The personal Nix channel is distinct from
public distribution: Apple Developer signing and notarization remain outside
this feature because they require external credentials and are unnecessary for
a non-quarantined Nix-store app on Pedro's managed Mac.

## User Scenarios & Testing

### User Story 1 — Install Lectrice through Nix (Priority: P1)

As the MacBook user, I can install Lectrice from its repository flake and launch
the resulting native app without manually cloning dependencies or copying a
build directory.

**Independent Test**: On `aarch64-darwin`, build the default flake package,
inspect the app bundle identity and Mach-O architecture, launch it through the
public macOS `open` command, and observe exactly one new Lectrice process with a
visible Quartz window.

**Acceptance Scenarios**:

1. **Given** an Apple-silicon Mac with Nix, **when** the default package is
   built, **then** the output contains exactly one
   `Applications/Lectrice.app` bundle.
2. **Given** the bundle, **when** its metadata is inspected, **then** its bundle
   id is `com.lectrice.reader`, its version matches the repository version, and
   its executable is arm64.
3. **Given** the built bundle, **when** it is opened, **then** one new Lectrice
   process owns a non-zero on-screen Quartz window.

### User Story 2 — Promote only Mac-verified revisions (Priority: P1)

As the maintainer, every protected-`main` candidate is built by the repo-scoped
Apple-silicon Mac runner. A successful build advances `macos-green`; a failed or
unrun candidate never reaches the Mac update channel.

**Independent Test**: The read-only Mac job builds and verifies an exact `main`
commit. Only after success, a separate checkout-free token job fast-forwards
`macos-green` to that SHA. A malformed bundle must fail before promotion.

**Acceptance Scenarios**:

1. **Given** a push to protected `main`, **when** the macOS workflow runs,
   **then** the build job has read-only permissions and runs on the repo-scoped
   self-hosted arm64 Mac without application/signing secrets.
2. **Given** a malformed package output, **when** the verifier runs, **then**
   the workflow fails and `macos-green` remains byte-for-byte unchanged.
3. **Given** a successful exact-SHA build, **when** the promotion job runs on
   the Linux runner, **then** it checks out no candidate code and fast-forwards
   `macos-green` without force.
4. **Given** a successful build, **when** CI records evidence, **then** the
   receipt names source commit, Nix output, bundle id, version, executable
   architecture, and unsigned/notarization truth boundary.

### User Story 3 — Receive updates without losing rollback (Priority: P2)

As the MacBook user, I can upgrade a dedicated Lectrice Nix profile to the
latest green channel automatically. A failed candidate leaves the active app
unchanged, and I can return to the previous profile generation.

**Independent Test**: Install the current package in an isolated profile,
record its generation and app hash, attempt an invalid revision, assert the
active generation/hash did not change, then upgrade to a newer valid revision
and roll back one generation.

**Acceptance Scenarios**:

1. **Given** an existing Lectrice profile, **when** a candidate build fails,
   **then** the profile generation and `~/Applications/Lectrice.app` target are
   unchanged.
2. **Given** a valid newer green revision, **when** the updater runs, **then**
   the profile advances atomically and the stable application symlink resolves
   to the new bundle.
3. **Given** at least two generations, **when** rollback runs, **then** the
   prior bundle becomes active without deleting Lectrice's application data.

### Edge Cases

- GitHub-hosted jobs are account billing-locked despite the repository being
  public: CI uses the repo-scoped Mac only after merge and never executes PR
  head code there.
- The Mac is asleep/offline: the exact-main job stays queued; `macos-green` and
  the installed app remain on the last successful revision.
- The app is running while the profile upgrades: the old process continues from
  its retained closure; only the next launch uses the new generation.
- GitHub or the Nix substituter is unavailable: update fails closed and keeps
  the existing generation.
- A candidate evaluates but does not contain a valid app bundle: verification
  fails before the stable symlink changes.
- A manually copied `/Applications/Lectrice.app` exists: it is retained under a
  dated backup name before the managed `~/Applications` path becomes canonical.
- The app is unsigned/not notarized: documentation must not present the Nix
  channel as a public distributable DMG.

## Requirements

### Functional Requirements

- **FR-001**: The flake MUST expose `packages.aarch64-darwin.default` and
  `packages.aarch64-darwin.lectrice`.
- **FR-002**: The package MUST produce exactly one app bundle at
  `$out/Applications/Lectrice.app` and a `lectrice` CLI symlink to its native
  executable.
- **FR-003**: Cargo and pnpm dependencies MUST come from committed lockfiles and
  fixed Nix dependency stores; the package build MUST be network-independent.
- **FR-004**: Existing Linux dev-shell and `tauri-driver` outputs MUST retain
  their current systems, versions, and dependency closure.
- **FR-005**: A deterministic verifier MUST fail on a missing bundle, wrong
  identifier, wrong version, non-arm64 executable, duplicate process, or absent
  Quartz window where a live-window check is requested.
- **FR-006**: CI MUST run the static macOS package verifier on the repo-scoped
  self-hosted arm64 Mac for protected `main` pushes; it MUST NOT execute pull
  request head code on that personal-data host.
- **FR-007**: The build job MUST be read-only and secret-free. A separate
  checkout-free Linux job MAY receive `contents: write` only to fast-forward
  `macos-green` after build success; force updates are forbidden.
- **FR-008**: The Mac installation MUST use a dedicated named Nix profile and a
  stable `~/Applications/Lectrice.app` symlink.
- **FR-009**: Update MUST be atomic: verification precedes symlink/profile
  activation and failure preserves the prior generation.
- **FR-010**: Rollback and update status MUST be runnable commands documented
  beside the install command.
- **FR-011**: Application data under `~/Library/Application Support` MUST NOT
  be removed, relocated, or included in profile cleanup.
- **FR-012**: Documentation MUST distinguish personal unsigned Nix delivery
  from Apple-signed/notarized public distribution.

## Success Criteria

- **SC-001**: `nix flake show --all-systems` exposes the two Darwin package
  names while Linux still exposes its dev shell and `tauri-driver` package.
- **SC-002**: A clean `nix build .#lectrice` on the M5 Mac succeeds from locked
  dependencies and passes bundle identifier/version/arm64 checks.
- **SC-003**: The Mac launch receipt reports one new process and a non-zero
  Quartz window for the exact Nix output.
- **SC-004**: The macOS CI check is green on the exact merged package revision
  and `macos-green` equals that SHA; a failed candidate leaves the branch
  unchanged.
- **SC-005**: An invalid update leaves profile generation and app symlink hash
  byte-for-byte unchanged.
- **SC-006**: Upgrade and rollback each change the active dedicated-profile
  generation exactly once, with the expected bundle identity afterward.
