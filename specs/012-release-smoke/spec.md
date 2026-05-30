# Spec 012 — Release Profile / Bundle Smoke (P0#5)

**Status:** Verification slice
**Branch:** `012-release-smoke` (off `origin/main` @ 7c5de09)
**Date:** 2026-05-30

## Goal

Confirm the aggressive release profile actually builds, and establish whether a
full distributable bundle can be produced in this environment — or document the
exact blocker (per the SKILL: "run a local Tauri build or document the missing
dependency"). No product behavior change.

## What was checked

### 1. Release profile (`src-tauri/Cargo.toml [profile.release]`)
```
panic = "abort"
codegen-units = 1
lto = true
opt-level = "s"
strip = true
```
Smoke: `cargo build --release` (binary + lib, default features = custom-protocol
+ elevenlabs-tts), with a `dist/` stub for `generate_context!`.
**Result: PASS (rc=0, 9m13s).** Produced `target/release/tauri-pdf-reader`, 15 MB,
stripped. The aggressive profile (lto + strip + panic=abort + opt-level="s")
builds and links cleanly — no profile defect.

**One release-only warning (benign):** `unused variable: specta_builder`
(lib.rs:213). `specta_builder` is consumed only inside the
`#[cfg(debug_assertions)]` TS-binding export at lib.rs:240-246, so in release
(debug_assertions off) it is constructed but unused. **Release IPC for the
default reader path is unaffected** — the library/highlight commands the UI uses
are registered via `tauri::generate_handler![…]` (lib.rs:273), unconditionally.
(Native `tts_*` commands are `#[cfg(feature = "native-tts")]`-gated and absent
from the default release by design; the UI gates its native-TTS path off when
unavailable, and the main path uses AI TTS.) Recommended cleanup (tiny, deferred — verifying
it needs another ~9-min release build): move the `let specta_builder = …`
construction inside the `#[cfg(debug_assertions)]` block. Related maintenance
hazard: the specta `collect_commands![…]` list (bindings) and the
`generate_handler![…]` list (IPC) are separate and must be kept in sync.

### 2. Bundle packaging — BLOCKED on tooling (documented blocker)
`tauri.conf.json` `bundle.active = true`, `bundle.targets = "all"` → a full
`tauri build` would attempt every Linux format (deb, rpm, AppImage). But the
bundling tools are **absent** in this environment:
- `linuxdeploy` — absent
- `appimagetool` — absent
- `cargo-tauri` (the `tauri` CLI) — absent (frontend uses `@tauri-apps/cli` via pnpm)

So the full bundle step cannot run here. This is the documented blocker, not a
defect. **Recommendation before any release:** either provision the bundle
toolchain (linuxdeploy + appimagetool, or nix `appimagekit`), or narrow
`bundle.targets` to the formats actually built (e.g. `["deb"]`) so `tauri build`
does not fail trying to assemble an AppImage. `strip = true` is fine for the
binary; AppImage assembly is the part that needs the missing tools.

### 3. WebKitGTK env — research item evaluated, NO change
Research priority #2 suggested evaluating `WEBKIT_DISABLE_DMABUF_RENDERER=1`
instead of `WEBKIT_DISABLE_COMPOSITING_MODE=1`. Inspected `lib.rs:147-154`:
`WEBKIT_DISABLE_COMPOSITING_MODE=1` is set **only inside the hw-accel-disable
path** (`should_disable_hw_accel()`), whose intent is *full software rendering*. For that intent, disabling all
compositing is correct; `DMABUF_RENDERER=1` would keep GPU compositing and thus
**contradict** the "disable hw accel" goal. The suggestion does not apply here —
no change. (If a *general* Linux render-glitch fix is ever needed outside the
disable-accel path, DMABUF would be the lighter choice — but no such code path
exists today.)

## Outcome

- Release profile build: **PASS** (rc=0, 15 MB stripped binary). Profile sound.
- One benign release-only warning (`specta_builder`), release IPC unaffected;
  trivial cleanup deferred.
- Bundle: blocked on `linuxdeploy`/`appimagetool` — tracked, with the
  narrow-targets / provision-toolchain recommendation.
- WEBKIT env: research item resolved (inapplicable), evidence above.

## Rollback

No code change (verification + documentation). N/A.
