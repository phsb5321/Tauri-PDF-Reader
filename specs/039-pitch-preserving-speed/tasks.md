---
description: "Task list — pitch-preserving playback speed (spec 039)"
---

# Tasks: Pitch-Preserving Playback Speed

**Input**: `specs/039-pitch-preserving-speed/` — [spec.md](./spec.md), [plan.md](./plan.md), [research.md](./research.md)
**Tests**: REQUIRED (constitution III — Test-First, 80%). Headless DSP gate is the central proof.

## Format: `[ID] [P?] [Story] Description`

- **[P]** = parallelizable (different files, no dep). **[Story]** = US1/US2/US3.

## ⚠️ Cross-cutting dependency (read first)

The moment `signalsmith-stretch` lands in `Cargo.toml` (T001), **CI cannot build it** until `clang/libclang` is added to `.github/workflows/ci.yml` (T015). T015 changes a workflow → **NOT self-merge class** (Merge-Ownership) → **Pedro-merged**. **Land T015 as its own tiny PR FIRST**, then the implementation PR builds green and stays self-mergeable. (Alternative: switch the engine to pure-Rust `timestretch` per [research.md](./research.md) → T001/T015 need no clang and T015 disappears.)

---

## Phase 1: Setup

- [ ] **T001** Add `signalsmith-stretch = "0.1.3"` to `src-tauri/Cargo.toml` under the `elevenlabs-tts` feature (next to `rodio`); confirm `rustfft` is reachable for `#[cfg(test)]` (add as `[dev-dependencies]` if not already transitive). `cargo fetch` + `cargo build --features elevenlabs-tts` locally (dev has clang).

## Phase 2: Foundational (BLOCKS all stories)

- [ ] **T002** [P] Define the shared **`SpeedRatio`** handle (newtype over `Arc<AtomicU32>` storing `f32::to_bits`, `get()`/`set(f32)` clamping to `[0.5, 4.5]`) in `src-tauri/src/ai_tts/stretch.rs`; written so both `StretchSource` (reader) and `AudioSink::set_speed` (writer) share one instance. Unit test: clamp at both ends + lock-free round-trip.

**Checkpoint**: shared speed handle exists + tested.

---

## Phase 3: User Story 1 — pitch held across the range (P1) 🎯 MVP

**Goal**: tempo changes 0.5×–4.5× with pitch constant; 1× transparent. **Independent test**: the FFT gate alone (no UI, no device).

### Tests (write FIRST, must FAIL)

- [ ] **T003** [P] [US1] `stretch_preserves_pitch_and_scales_duration` in `src-tauri/src/ai_tts/stretch.rs` `#[cfg(test)]`: synth a pure sine at f0 (e.g. 440 Hz) at the source rate; run `StretchSource` at ratios **0.5, 1.0, 2.0, 4.5**; FFT output (`rustfft`); assert dominant bin within **≤3%** of f0 (SC-001) AND `out_len ≈ in_len / ratio` within **≤2%** (SC-002).
- [ ] **T004** [P] [US1] `unity_ratio_is_transparent`: ratio 1.0 → output samples equal input (bypass path; SC-003).

### Implementation

- [ ] **T005** [US1] Implement `StretchSource<S: rodio::Source<Item = f32>>` in `src-tauri/src/ai_tts/stretch.rs`: `Iterator<Item = f32>` + `Source`; owns a `signalsmith_stretch::Stretch` sized to the source `sample_rate`/`channels`; reads `SpeedRatio`; **reports the source's own `sample_rate()`/`channels()` unchanged**; output ring buffer refilled by reading an input block → `process()` at the current ratio; **1× = transparent bypass** (no stretcher). `total_duration()` = source ÷ ratio (best-effort). Make T003/T004 pass.

**Checkpoint** (MVP): pitch-preserving stretch proven headlessly at every ratio. Engine done, not yet wired to playback.

---

## Phase 4: User Story 2 — extended range, reachable + persisted (P2)

**Goal**: user selects 0.5×–4.5× from the control, hears it pitch-preserved, value persists. **Independent test**: range/clamp tests (be + fe) + the slider reaches 4.5×.

### Tests (write FIRST)

- [ ] **T006** [P] [US2] Backend `cargo test --features test-mocks`: `set_speed` accepts 4.5, clamps `>4.5`→4.5 and `<0.5`→0.5 (FR-011) — in `player.rs` (via the `MockSink`) and `mod.rs` validation.
- [ ] **T007** [P] [US2] Frontend Vitest: `ai-tts-store` clamps to `MAX_SPEED = 4.5`; `AiSpeedSlider` `max` is 4.5 and `SPEED_LABELS` cover the new top (e.g. 3×/4×/4.5×).

### Implementation

- [ ] **T008** [US2] In `src-tauri/src/ai_tts/player.rs`: `RodioSink::play_mp3` wraps the decoder in `StretchSource::new(decoder, ratio_handle)` before `sink.append`; `AudioSink::set_speed` writes the **`SpeedRatio` handle** (delete the pitch-shifting `s.set_speed(clamp(0.5,2.0))` rodio call); the `RodioSink` owns one shared `SpeedRatio`. (Audio thread already owns the sink — no new lock across `sleep_until_end`; deadlock gate untouched.)
- [ ] **T009** [US2] In `src-tauri/src/ai_tts/mod.rs`: widen `AiTtsEngine::set_speed` validation `0.5..=2.0` → `0.5..=4.5` (error message updated).
- [ ] **T010** [P] [US2] Frontend: `src/stores/ai-tts-store.ts` `MAX_SPEED` 2.0→4.5; `src/components/playback-bar/AiSpeedSlider.tsx` `MAX_SPEED` + `SPEED_LABELS` to 4.5×.

**Checkpoint**: end-to-end — pick up to 4.5×, pitch-preserved, restored after restart (FR-001/006/007/011).

---

## Phase 5: User Story 3 — live mid-playback change + karaoke sync (P3)

**Goal**: change speed during playback (no restart/gap) and the highlight stays aligned. **Independent test**: the karaoke-sync clock test at speed + a backend mid-stream-ratio assertion.

### Tests (write FIRST)

- [ ] **T011** [P] [US3] Extend `src/__tests__/integration/karaoke-sync.test.ts`: with speed 2× set in the store, the highlight index crosses each word boundary at **half** the wall-clock time (proves selection uses `elapsed · speed`); change speed mid-play → highlight matches the new-speed expectation with **0** drift beyond one frame (SC-006).

### Implementation

- [ ] **T012** [US3] In `src/hooks/useTtsWordHighlight.ts`: read current speed from `useAiTtsStore` and multiply `elapsed` by it before `findWordIndexAtTime` / `isPlaybackComplete` (word timings are 1×-relative; FR-009). Completion stays event-driven (`ai-tts:finished`, PR #29) so FR-010 already holds; the scaled timer is just the consistent fallback.
- [ ] **T013** [US3] Backend assertion (`player.rs` `#[cfg(test)]` with `MockSink`/a counting stretch stub): writing the `SpeedRatio` mid-stream changes the consumed/produced ratio **without** a restart or a drained-then-empty underrun (FR-008). Pairs with the soak (T014).

**Checkpoint**: all three stories independently functional.

---

## Phase 6: Polish, gates & cross-cutting

- [ ] **T014** [P] Real-time soak (risk #3): a longer `stretch.rs` test feeding a multi-second buffer at 4.5× confirms `process()` keeps the output buffer fed (no underrun) — stretch outruns playback.
- [x] **T015** Add `clang libclang-dev` to the `apt-get install` lines of the CI jobs in `.github/workflows/ci.yml` (bindgen needs libclang to build `signalsmith-stretch`). **DONE — merged as PR #31 (`ci(040)`)**, landed as its own Pedro-gated workflow PR before the impl PRs.
- [ ] **T016** **[Pedro one-time]** Add a speed step to `docs/gui-validation-019-026.md`: at 4.5×, transcribe a sample, confirm ≥90% word recognition (SC-004 — the one non-mechanizable gate).
- [x] **T017** Update `docs/agent-backlog-state.md` — **DONE** (Iteration #20): spec 039 spec→plan→tasks→impl shipped + merged (#30/#31/#32) + restored-session re-verified; remaining backlog = SC-004 ear-check + Tier 3 (release pipeline, Kokoro, E2E→CI lane).

---

## Dependencies & order

- **T015 (CI clang) gates CI green for everything after T001** → merge it FIRST (Pedro). Until then, build/test T001+ locally (dev has clang).
- **T001 → T002 → US1 (T003/T004 → T005)** — StretchSource is the MVP; nothing else builds on speed without it.
- **US2 (T008) depends on US1 (T005)** — wires the source into the player. T009/T010 [P] alongside.
- **US3 (T012/T013) depends on US2 (T008)** — needs the live handle wired.
- Within a story: tests FAIL first, then implement (constitution III). Commit per task/logical group.

## PR slicing (suggested, each self-mergeable except T015)

1. **PR-A (Pedro)**: T015 only — CI clang. Merge first.
2. **PR-B**: T001 + US1 (T002–T005) — dep + StretchSource + FFT gate. The MVP; green once PR-A is in.
3. **PR-C**: US2 (T006–T010) — wire into player + widen range (be + fe).
4. **PR-D**: US3 (T011–T013) + polish (T014) + docs (T016–T017).

Each PR: green CI + review-clean + ≤1 service → self-merge per Merge-Ownership (except PR-A). Hold draft PR #30 (spec/plan/tasks) until the impl PRs land, or convert it to PR-B's base.

## Parallel example (US1 tests)

```
T003  FFT pitch+duration gate   (stretch.rs)
T004  unity-ratio transparency  (stretch.rs)  # same file → sequential, not [P] across each other in practice
```

Cross-story [P]: T006 (backend range) ∥ T007 (frontend range) ∥ T010 (frontend consts) — different files.
