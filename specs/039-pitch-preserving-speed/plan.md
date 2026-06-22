# Implementation Plan: Pitch-Preserving Playback Speed

**Branch**: `039-pitch-preserving-speed` | **Date**: 2026-06-21 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `specs/039-pitch-preserving-speed/spec.md` · Phase 0: [research.md](./research.md)

## Summary

Insert a **pitch-preserving time-stretch stage** into the AI-TTS rodio playback path so playback speed can span **0.5×–4.5×** with the voice's pitch held constant (today `set_speed` resamples → pitch shifts, capped at 2.0×). Approach (verified in [research.md](./research.md)): wrap the MP3 decoder in a custom `rodio::Source` (`StretchSource`) that feeds decoded f32 samples through **`signalsmith-stretch`** (MIT, streaming `process()`), reporting the **original** sample rate so rodio plays back at native pitch while duration scales by the speed ratio. The ratio lives in a shared handle so speed changes apply live, mid-playback. The transform sits behind the existing `AudioSink` port; its pure pitch/duration behavior is asserted headlessly by an FFT gate (no audio device).

## Technical Context

**Language/Version**: Rust 2021 (backend DSP), TypeScript 5.6 (speed control UI)
**Primary Dependencies**: `rodio` 0.20 (existing); **NEW** `signalsmith-stretch` 0.1.3 (MIT, time-stretch); `rustfft` (dev/test only, for the headless gate — already in the tree via other crates, else dev-dependency)
**Build toolchain**: `signalsmith-stretch` builds vendored C++ via `cc` + `bindgen` → needs **C++14 + libclang** at compile time (present on dev; **must be added to CI** — see Risks)
**Storage**: none new — speed persists via the existing settings store (extend range only)
**Testing**: `cargo test --features test-mocks` (DSP unit + FFT gate); Vitest (frontend range + karaoke-at-speed)
**Target Platform**: Linux desktop (Tauri 2.x, niri/Wayland)
**Project Type**: single (Tauri desktop: `src/` frontend + `src-tauri/` backend)
**Performance Goals**: stretch faster than real-time at every ratio (no underrun); ≤ one-buffer added latency; speed change applies within a small bounded transition (no restart/gap)
**Constraints**: pitch within **≤3%** of 1× (SC-001); duration `÷speed` within **≤2%** (SC-002); 1× transparent (SC-003); all DSP assertions run with **no audio device**

## Constitution Check

_GATE: must pass before Phase 0 (passed) and re-checked after design (passed)._

| Principle               | Compliance                                                                                                                                                                                                                                                                              |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **I. Hexagonal**        | DSP is an infrastructure/adapter concern. `StretchSource` lives in `src-tauri/src/ai_tts/` behind the existing `AudioSink` trait (the port). Pure ratio→buffer math is unit-testable without a device. No domain/UI leakage. ✓                                                          |
| **II. Type-safe IPC**   | No new IPC pattern. Speed already flows through `aiTtsSetSpeed` → `ai_tts_set_speed` command. Only the validated range widens (0.5–2.0 → 0.5–4.5). ✓                                                                                                                                    |
| **III. Test-First 80%** | New `StretchSource` ships with the FFT gate (SC-001/SC-002), a 1× transparency test (SC-003), and range/clamp tests; frontend gets a karaoke-at-speed test (SC-006). Coverage floors held. ✓                                                                                            |
| **IV. Design system**   | Frontend change reuses `AiSpeedSlider` + tokens; only `MAX_SPEED` + the labels map grow. No new ad-hoc styles. ✓                                                                                                                                                                        |
| **V. State patterns**   | Speed stays in `useAiTtsStore` (extend `MIN/MAX_SPEED`); the audio-thread ratio handle uses the established ref/shared-state pattern; transitions logged. ✓                                                                                                                             |
| **New dependency**      | `signalsmith-stretch` is justified: rodio offers no pitch-preserving option, and it is the verified MIT/maintained/streaming choice. Documented per the "no new deps unless required" rule — the feature inherently requires a DSP engine. ✓ (with the CI build-dep caveat, see Risks). |

**No violations** → Complexity Tracking table omitted.

## Project Structure

### Documentation (this feature)

```text
specs/039-pitch-preserving-speed/
├── spec.md          # WHAT/WHY (done)
├── research.md      # Phase 0 — crate landscape + decision (done)
├── plan.md          # this file
└── tasks.md         # Phase 2 — created by /speckit.tasks (NOT here)
```

### Source code (the change surface)

```text
src-tauri/src/ai_tts/
├── stretch.rs        # NEW — StretchSource<S: rodio::Source>: wraps the decoder, owns a
│                     #       signalsmith Stretch, reads a shared speed-ratio handle, reports
│                     #       the SOURCE sample_rate/channels unchanged. 1× = transparent bypass.
├── player.rs         # RodioSink::play_mp3 wraps the decoder in StretchSource before append;
│                     #   AudioSink::set_speed routes to the ratio handle (NOT rodio set_speed).
│                     #   set_speed clamp 0.5..=2.0 → 0.5..=4.5. (Audio thread already owns the sink.)
└── mod.rs            # AiTtsEngine::set_speed validation 0.5..=2.0 → 0.5..=4.5.

src-tauri/Cargo.toml  # + signalsmith-stretch (under the elevenlabs-tts feature, with rodio)

src/
├── stores/ai-tts-store.ts          # MIN_SPEED/MAX_SPEED 0.5/2.0 → 0.5/4.5
├── components/playback-bar/AiSpeedSlider.tsx  # MAX + SPEED_LABELS extend to 4.5×
└── hooks/useTtsWordHighlight.ts     # scale highlight elapsed by current speed (FR-009)

.github/workflows/ci.yml             # + clang/libclang for bindgen (Pedro-gated — see Risks)
```

**Structure Decision**: single Tauri project; the DSP is localized to `src-tauri/src/ai_tts/` behind the existing port, plus a thin frontend range/sync change.

## Design detail

### 1. `StretchSource` (the core, FR-002/FR-003/FR-012)

- Implements `rodio::Source` + `Iterator<Item=f32>`, wrapping the f32 decoder.
- Holds a `signalsmith_stretch::Stretch` configured for the source's sample-rate/channels.
- **Reports the source's own `sample_rate()`/`channels()` unchanged** — this is what keeps pitch constant; rodio plays at native rate, tempo handled internally.
- `next()` pulls from an output ring buffer; on empty, reads a block of decoded input, calls `process()` at the current ratio, refills.
- **1× transparent bypass (FR-003/SC-003)**: when ratio == 1.0, skip the stretcher entirely and pass decoded samples straight through — guarantees bit-transparency + zero added latency.
- `total_duration()` returns the source duration ÷ current ratio (best-effort; completion is event-driven regardless, see §4).

### 2. Live speed handle (FR-008)

- Speed ratio stored in a shared handle owned across the player↔audio-thread boundary (e.g. `Arc<AtomicU32>` holding `f32::to_bits`, or a small `Arc<Mutex<f32>>`). `StretchSource` reads it each refill; signalsmith absorbs ratio changes mid-stream smoothly → no restart, no gap.
- `AudioSink::set_speed` updates the handle. The dedicated audio thread (PR #19) already owns the sink, so this is a lock-free/handle write — **no new lock across `sleep_until_end`** (deadlock gate stays satisfied; no change to `player.rs` locking).

### 3. Karaoke sync at speed (FR-009/SC-006)

- Word timings from ElevenLabs are at **1× time**. At speed S, after `t` real seconds the audio has advanced `t·S` of 1×-content. So the highlight loop must select words by **`elapsed · speed`**, not raw `elapsed`.
- Change in `useTtsWordHighlight.updateHighlight`: multiply elapsed by the current speed before `findWordIndexAtTime` / `isPlaybackComplete`. Speed read from `useAiTtsStore`.

### 4. Completion at speed (FR-010)

- Already correct: completion is **event-driven** off `ai-tts:finished` (PR #29), which fires when the stretched source drains — independent of speed. The timer fallback (`isPlaybackComplete`, 1×-duration) would fire late at high speed, but the event wins; for tidiness the timer path also uses `elapsed·speed` (§3), so it stays consistent.

### 5. Range widening (FR-001/FR-006/FR-007/FR-011)

- Backend clamps 0.5..=2.0 → 0.5..=4.5 (`mod.rs` validation, `player.rs` `set_speed`). Frontend `MIN/MAX_SPEED` + slider `max` + labels to 4.5×. Out-of-range clamps to nearest (FR-011). Persistence unchanged (existing settings store), now over the wider band.

## Verification plan (the gates)

**Headless DSP gate** — `src-tauri/src/ai_tts/stretch.rs` `#[cfg(test)]`, no device:

- `stretch_preserves_pitch_and_scales_duration`: synth a pure sine at f0 (e.g. 440 Hz) at the source rate; run `StretchSource` at ratios **0.5, 1.0, 2.0, 4.5**; FFT the output (`rustfft`); assert the dominant bin ≈ f0 **within ≤3%** (SC-001) AND output length ≈ input_len ÷ ratio **within ≤2%** (SC-002).
- `unity_ratio_is_transparent`: ratio 1.0 → output samples equal input (bypass; SC-003).
- `set_speed_clamps_to_supported_range`: values <0.5 / >4.5 clamp (FR-011).

**Frontend** — Vitest:

- Extend `karaoke-sync.test.ts`: at speed 2×, highlight index advances at **half** the wall-clock boundaries (proves `elapsed·speed`); SC-006 (no drift > 1 frame after a mid-play speed change).
- `AiSpeedSlider` exposes ≤0.5–4.5 range (SC-005).

**Manual (one-time, Pedro)** — SC-004: at 4.5×, transcribe a sample, confirm ≥90% word recognition. Added to `docs/gui-validation-019-026.md` as a speed step.

## Risks & gating

1. **CI build dependency (Pedro-gated).** `signalsmith-stretch` needs clang/libclang in CI (`bindgen`). The `.github/workflows/ci.yml` `apt-get install` must gain `clang libclang-dev`. **Changing `.github/workflows` is NOT self-merge class** (Merge-Ownership) → the CI-deps change is a **Pedro-gated** step. Mitigation: land the workflow change as its own small PR (or the impl PR is explicitly Pedro-merged). Without it, Backend/Contract CI cannot build the crate.
2. **Pure-Rust escape hatch.** If the C++/CI dependency is unwanted, swap the engine to `timestretch` (pure-Rust, only `rustfft`, no `ci.yml` change). Same `StretchSource`/`AudioSink` architecture → localized swap. Primary stays signalsmith per direction; this is the documented pivot.
3. **Real-time budget.** Stretch must outrun playback at 4.5×. Signalsmith is fast, but the dedicated audio thread must not underrun — verify with a soak (not just the FFT gate). Captured as a task.
4. **Speech @4.5× intelligibility (SC-004)** is the one genuinely human gate — not mechanizable; one-time check.

## Next

`/speckit.tasks` → `tasks.md` (dependency-ordered: Cargo dep → `StretchSource` + FFT gate → player wiring + live handle → range widen (be/fe) → karaoke-at-speed → CI clang [Pedro] → GUI step). Then implement. Hold PR #30 as draft until tasks + impl land; the CI-deps slice surfaces to Pedro.
