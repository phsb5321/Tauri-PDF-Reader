# Codex Adversarial Review — Spec 012 (Release / Bundle Smoke)

- **Date:** 2026-05-30
- **Tool:** `codex exec --sandbox read-only` (codex-cli 0.133.0)
- **Verdict:** Spec technically valid. Docs-only (no code change).

## Confirmed
- `cargo build --release` artifact exists (~15M, stripped); release profile sound
  (tradeoffs only: slower build, no unwind panic recovery, fewer crash symbols).
- `specta_builder` warning is benign for release IPC; commands mount via
  `generate_handler!` (lib.rs:273). The separate `collect_commands![]` vs
  `generate_handler![]` lists are a real drift hazard (confirmed).
- Bundle genuinely blocked: `linuxdeploy`/`appimagetool`/`cargo-tauri`/`tauri`/`pnpm`
  absent. "Narrow `bundle.targets` or provision the toolchain" is the right call.
- WEBKIT claim sound.

## MINOR (addressed — spec wording tightened)
1. "ALL commands the frontend invokes are in generate_handler!" was overstated:
   native `tts_*` are `#[cfg(feature="native-tts")]`-gated, absent from default
   release by design (UI gates native-TTS off when unavailable; main path = AI
   TTS). Spec reworded to "default reader path".
2. `should_disable_hw_accel()` wording over-specified ("safe mode / bad GPU") —
   reworded to just "the hw-accel-disable path".

No BLOCKER/MAJOR against the slice. The bundle block is the documented
environment limitation this slice set out to establish, not a defect.
