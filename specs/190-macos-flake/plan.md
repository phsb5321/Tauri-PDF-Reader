# Implementation Plan: Reproducible macOS Flake Delivery

**Branch**: `190-macos-flake` | **Date**: 2026-08-26 | **Spec**: [spec.md](./spec.md)

## Summary

Extend the existing flake rather than add a second packaging system. Linux keeps
its current development outputs. `aarch64-darwin` receives a Tauri package built
with nixpkgs' native `cargo-tauri.hook`, `rustPlatform.buildRustPackage`,
`fetchPnpmDeps`, and the committed Cargo/pnpm lockfiles. A platform verifier
checks the app's immutable identity and optionally performs a real Mac launch.
A separate workflow-only slice runs the static package gate on GitHub's arm64
macOS runner. A dedicated Nix profile on `Mac.Pro` provides atomic update and
rollback generations.

## Technical Context

**Languages**: Nix, Bash, GitHub Actions YAML; existing Rust 2021 + TypeScript 5.6 application.
**Build primitives**: nixpkgs `cargo-tauri.hook`, `rustPlatform.buildRustPackage`, `fetchPnpmDeps`, `pnpmConfigHook`, pnpm 10, Node 22.
**Target**: `aarch64-darwin` / M5 MacBook, macOS 26.6.1.
**CI**: standard `macos-15` arm64 GitHub-hosted runner plus a SHA-pinned Nix installer; public repositories receive unlimited standard hosted use according to GitHub's current runner reference.
**Distribution**: personal Nix profile, no browser download/quarantine; no Apple signing/notarization claim.
**Verification**: Nix evaluation/build, plist identity, Mach-O architecture, `codesign` structural verification when present, process-delta observation, CoreGraphics window ownership, profile generation negative control and rollback.
**Constraints**: preserve Linux outputs; no app source/capability/egress changes; workflow changes are Pedro-gated; application data is outside Nix generations.

## Constitution Check

- **Hexagonal/IPC/state/UI principles**: no application source changes. PASS.
- **Test-first and verification discipline**: package and installer logic ship
  with a fail-closed shell verifier and negative controls; a real Mac launch is
  the user journey. PASS.
- **Resource policy**: target checks run sequentially; one Mac build at a time.
  PASS.
- **Merge ownership**: the package/docs slice is safe-class. The workflow-only
  slice touches `.github/workflows` and therefore remains `[pending] Pedro` even
  when green. PASS by explicit split/escalation.
- **Security**: CI has `contents: read`, no signing secrets, no persisted book
  contents, and no deploy token. PASS.

## Research Decisions

1. **Use nixpkgs' Tauri hook**: the exact pinned hook was read before implementation. It invokes `cargo tauri build --bundles app`, then moves only generated `.app` bundles into `$out/Applications`; hand-building a bundle would duplicate a native platform feature.
2. **Use fixed pnpm/Cargo stores**: `fetchPnpmDeps` + `pnpmConfigHook` is the
   current nixpkgs-supported pnpm path. `cargoLock.lockFile` avoids an unrelated
   vendor hash because the lock contains registry dependencies only.
3. **Build on ARM64**: GitHub currently documents `macos-15` as a standard M1
   arm64 runner and standard public-repository runners as free/unlimited.
4. **Do not add signing secrets**: Tauri requires an Apple Developer identity and notarization for general direct distribution. After all Nix fixups, the derivation uses macOS `codesign -s -` to seal the executable and bundle with a strict-verifiable ad-hoc signature. The managed Nix-store app is a personal channel and is not represented as a public DMG.
5. **Atomic profile channel**: `nix profile install/upgrade --profile` realizes the candidate before switching the profile generation. The manager keeps the public app link pinned to the previous immutable generation, verifies the candidate, restores the exact prior profile version on failure, and only then repoints the app link to a successful immutable generation.
6. **No self-updater in app code**: Nix owns package updates and rollback; an
   application updater would duplicate state and weaken reproducibility.

## Slices

### Slice A — Package + verifier + documentation (safe-class)

- Restructure `flake.nix` to evaluate Linux plus `aarch64-darwin` lazily.
- Add `nix/lectrice-darwin.nix` using native nixpkgs package hooks.
- Add static/live verification and profile-management scripts.
- Document install/update/rollback and update truthful platform support.
- Build and launch on `Mac.Pro`; independently review, merge, and install.

### Slice B — macOS CI (workflow-gated)

- Add a standalone least-privilege arm64 workflow with a SHA-pinned Nix installer.
- Build `.#lectrice`, run static verifier, negative control, and upload a small
  identity receipt only on failure/success as appropriate.
- Add the check to the ruleset only after the workflow exists on base.
- Open green PR; do not self-merge because it changes GitHub Actions.

### Slice C — continuous Mac update

- Maintain a dedicated `lectrice` profile and stable user Applications symlink.
- Schedule a user-level update after Slice B becomes required, so `main` is a
  green channel rather than merely a moving branch.
- Verify failed-candidate preservation and one-generation rollback.

## Files

```text
flake.nix
nix/lectrice-darwin.nix
scripts/verify-macos-flake.sh
scripts/manage-macos-flake.sh
docs/macos-nix.md
docs/KNOWN_LIMITATIONS.md
README.md
specs/190-macos-flake/{spec,plan,tasks}.md
.github/workflows/macos-flake.yml       # Slice B, separate gated PR
```

## Rollback

- Repository package: `git revert <squash-sha>` through a PR.
- Mac application: `nix profile rollback --profile ~/.local/state/nix/profiles/lectrice`; the stable app symlink remains unchanged because it targets the profile, not a generation path.
- Manual copies are moved to dated backup names and can be restored without touching app data.
