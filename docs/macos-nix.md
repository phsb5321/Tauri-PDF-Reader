# Lectrice on macOS through Nix

Lectrice exposes a native Apple-silicon package as
`packages.aarch64-darwin.lectrice` (also `default`). It builds the committed
pnpm and Cargo lockfiles into an ad-hoc-signed `Lectrice.app` and keeps update
rollback in a dedicated Nix profile.

## Support boundary

This channel is for Pedro's Nix-managed MacBook. The app does not arrive through
a browser, so it has no download quarantine. It is **ad-hoc signed**, not Apple
Developer signed or notarized, and is not a public DMG distribution claim.
Application data remains in macOS application-support directories and is never
part of a Nix generation.

The package gate proves bundle identity, arm64 architecture, signature integrity,
process ownership, and a real Quartz window. It does not make `tauri-driver`
work on macOS or prove every Linux packaged reader journey there.

## Install

After the package is on `main`:

```bash
nix run github:phsb5321/Tauri-PDF-Reader/main#manage -- install
```

This command:

1. realizes `github:phsb5321/Tauri-PDF-Reader/main#lectrice`;
2. installs it into `~/.local/state/nix/profiles/lectrice`;
3. verifies the bundle before exposing it;
4. moves an existing non-symlink `~/Applications/Lectrice.app` to a dated
   `.manual-YYYYMMDD-HHMMSS` backup; and
5. creates `~/Applications/Lectrice.app` as a stable link through the profile.

A separately hand-copied `/Applications/Lectrice.app` is not deleted by the
script. Once the managed app is verified, move that duplicate to a dated backup
so Spotlight does not present two Lectrice installations.

## Status and exact verification

```bash
PROFILE="$HOME/.local/state/nix/profiles/lectrice"
"$PROFILE/bin/manage-macos-flake.sh" status
"$PROFILE/bin/verify-macos-flake.sh" --output "$PROFILE" --launch
```

`--launch` uses the public macOS `open -n` path, finds the process for the exact
immutable bundle, requires one 100×100-or-larger on-screen Quartz window, writes
no book content, then terminates only the process it launched.

## Update

```bash
PROFILE="$HOME/.local/state/nix/profiles/lectrice"
"$PROFILE/bin/manage-macos-flake.sh" update
```

The profile remembers the unlocked GitHub source. `nix profile upgrade`
realizes the candidate before switching the generation. The manager then checks
the app identity/signature/architecture. A failed realization leaves the active
generation unchanged; a failed post-build check triggers rollback before the
stable app link is touched.

The last machine-readable operation receipt is:

```text
~/.local/state/lectrice/update-receipt.json
```

It contains only channel, generation, app-link, result, and timestamp—not PDF
names, text, credentials, or application state.

Automatic scheduling is enabled only after the arm64 macOS package check is on
the protected branch. Until then, run the explicit update command above. The
scheduled job uses this same command; it does not implement a second updater.

## Rollback

```bash
PROFILE="$HOME/.local/state/nix/profiles/lectrice"
"$PROFILE/bin/manage-macos-flake.sh" rollback
```

The stable app link points at the profile, not a store generation, so rollback
changes the next launch without rewriting the link. A currently running process
continues from its old retained closure and can be closed normally.

Do not run `nix profile wipe-history --profile "$PROFILE"` or a global garbage
collection that removes old generations before the rollback window has passed.

## Build without installing

```bash
OUT="$(nix build github:phsb5321/Tauri-PDF-Reader/main#lectrice \
  --no-link --print-out-paths)"
nix run github:phsb5321/Tauri-PDF-Reader/main#verify -- --output "$OUT"
```

For repository development on the Mac:

```bash
nix build .#lectrice
./scripts/verify-macos-flake.sh --output "$(nix path-info .#lectrice)" --launch
```

## Recovery

- Profile update failed: read `~/.local/state/lectrice/update-receipt.json`; the
  old generation remains active.
- New build passed static checks but behaves badly: run `rollback`, close the
  current process, and relaunch `~/Applications/Lectrice.app`.
- Restore the former manual app: remove only the managed symlink, then rename
  the retained `.manual-*` directory back to `Lectrice.app`.
- Revert the repository package: one PR with `git revert <macOS-flake-squash>`.
