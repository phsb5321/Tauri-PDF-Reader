# Feature Specification: Pitch-Preserving Playback Speed

**Feature Branch**: `039-pitch-preserving-speed`
**Created**: 2026-06-21
**Status**: Draft
**Input**: User description: "wire audio-finished … remaining substantive backlog: speed 2×–4.5× pitch-preserving DSP (rodio set_speed shifts pitch — chipmunk)"

## Context (non-normative)

Today the AI-TTS audio path plays generated speech through a resampling speed
control: changing speed also changes pitch (faster → chipmunk, slower → drone),
and the range is capped at **0.5×–2.0×** (`ai-tts-store` `MIN/MAX_SPEED`,
`AiSpeedSlider`, backend `set_speed` validation, and the player's
`set_speed(speed.clamp(0.5, 2.0))`). Listeners who want to read fast — the
core value of a read-aloud app — cannot push past 2× without the voice becoming
unintelligible from pitch distortion. This feature decouples **tempo from
pitch** so speed can go higher while the voice keeps its natural pitch.

**Scope**: the AI-TTS audio playback path (generated audio rendered through the
local player). The native-TTS path (OS speech engine) already adjusts rate
through the engine itself and is out of scope here.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Listen faster without the chipmunk effect (Priority: P1)

A reader opens a document, starts read-aloud, and increases the speed to read
through the page faster. The voice plays back faster but keeps its natural
pitch — it sounds like the same speaker talking quickly, not a sped-up tape.

**Why this priority**: This is the entire point of the feature and the single
biggest blocker to using the app for real reading. Without pitch preservation,
any speed above ~1.5× is uncomfortable and above ~2× unintelligible. Shipping
just this story — pitch held constant across the existing usable range —
already delivers the core value.

**Independent Test**: Play a known reference tone / utterance at several speeds
and confirm the perceived pitch (fundamental frequency) is unchanged while the
duration shortens. Fully testable headlessly on synthesized audio, with no
device and no human ear required for the pitch/duration claim.

**Acceptance Scenarios**:

1. **Given** read-aloud is playing at 1×, **When** the reader raises speed to 2×, **Then** playback runs at ~2× tempo AND the fundamental pitch is unchanged from 1× (within tolerance).
2. **Given** speed is set to 1×, **When** audio plays, **Then** the output is transparent — indistinguishable from playback with no speed processing (no artifacts introduced by the always-on path).
3. **Given** a slower setting (0.5×), **When** audio plays, **Then** tempo halves AND pitch is unchanged (no drone/down-pitch).

---

### User Story 2 - Extended speed range for speed-reading (Priority: P2)

A practiced reader pushes the speed well past today's 2× ceiling — up to **4.5×**
— to skim audio at speed-reading pace, and the voice stays intelligible.

**Why this priority**: High-multiplier playback is the differentiator for power
users, but it only makes sense once P1 (pitch preservation) exists — raising the
cap without it would just produce faster chipmunk. Delivered second because P1 is
usable on its own; this extends the envelope.

**Independent Test**: Set speed to the new maximum, confirm tempo scales and
pitch holds across the full 0.5×–4.5× range on the reference signal; confirm the
control (slider + settings) exposes and remembers the extended range.

**Acceptance Scenarios**:

1. **Given** the speed control, **When** the reader opens it, **Then** the selectable range reaches at least 4.5× (above today's 2.0× cap).
2. **Given** speed is set to 4.5×, **When** audio plays, **Then** pitch is still unchanged from 1× and the words remain recognizable.
3. **Given** a chosen speed, **When** the app is closed and reopened, **Then** the same speed is restored (persisted, as today).

---

### User Story 3 - Change speed mid-playback, highlight stays in sync (Priority: P3)

While read-aloud is playing, the reader adjusts speed and playback continues
smoothly from where it was — no restart, no silence gap — and the karaoke word
highlight keeps tracking the spoken word at the new speed.

**Why this priority**: A quality-of-life refinement on top of P1/P2. The feature
is already valuable if speed is chosen before play; live adjustment removes
friction but is not required for the core win.

**Independent Test**: Drive the playback/highlight state on a controlled clock,
change speed partway through, and assert the highlight index continues to track
the (now rescaled) word timings without jumping or stalling.

**Acceptance Scenarios**:

1. **Given** audio is playing at 1×, **When** the reader changes speed to 2× mid-clip, **Then** playback continues from the current position at the new tempo with no audible restart and no gap beyond a small bounded transition.
2. **Given** the karaoke highlight is active, **When** speed changes mid-playback, **Then** the highlighted word stays aligned with the audio at the new speed (timings rescale, not drift).
3. **Given** audio is paused at a non-1× speed, **When** the reader resumes, **Then** playback resumes at the set speed with pitch preserved.

---

### Edge Cases

- **Speed = 1.0 exactly**: MUST be a transparent passthrough — the always-on
  speed path may not color, delay, or degrade audio when no change is requested.
- **Maximum speed (4.5×)**: words must remain recognizable; define the
  intelligibility floor as a measurable bar, not "sounds OK".
- **Mid-clip speed change**: no restart and no silence gap beyond a small,
  bounded transition; position is preserved.
- **Pause/resume at non-1× speed**: resumes at the same speed, pitch preserved,
  highlight re-anchored.
- **Karaoke timing at speed**: word timings are expressed at 1× and MUST rescale
  with speed so the highlight neither leads nor lags the audio.
- **Auto-page at speed**: page completion / auto-advance fires off the real
  audio-end signal (`ai-tts:finished`) and remains correct at any speed — the
  completion trigger MUST NOT assume 1× duration.
- **Very low / very high extremes & out-of-range input**: values outside the
  supported range are clamped to the nearest supported speed (never error to the
  user, never apply an unsupported factor).

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The AI-TTS playback path MUST support a continuous playback-speed range from at least **0.5× to 4.5×** (today's ceiling is 2.0×).
- **FR-002**: Across the entire supported speed range, the **fundamental pitch of the voice MUST remain unchanged** from 1× within a defined tolerance — changing speed MUST NOT shift pitch.
- **FR-003**: At **exactly 1.0× the audio MUST be transparent** — output equivalent to playback with no speed processing, introducing no added latency or artifacts.
- **FR-004**: Playback **duration MUST scale inversely with speed** (e.g. 2× plays in ~half the time) within a defined tolerance.
- **FR-005**: The voice MUST remain **intelligible at the maximum supported speed** (measurable word-recognition bar, not subjective).
- **FR-006**: Users MUST be able to **set the speed from the playback control and from settings**, with the control exposing the full supported range.
- **FR-007**: The selected speed MUST **persist across app restarts** (preserving today's behavior over the new range).
- **FR-008**: Speed changes MUST be **applicable live during playback** without restarting the current utterance and without a silence gap beyond a small bounded transition.
- **FR-009**: The **karaoke word highlight MUST stay synchronized** with the audio at any speed, including after a mid-playback speed change (1×-relative word timings rescale with speed).
- **FR-010**: Completion / auto-page advance MUST stay correct at any speed — it MUST be driven by the real audio-end signal, not a 1×-duration assumption.
- **FR-011**: Speed values outside the supported range MUST be **clamped to the nearest supported value**, never surfaced as an error.
- **FR-012**: The feature MUST honor the existing architecture boundaries — speed/DSP logic placed behind the player's existing sink/port abstraction, with the pure transform unit-testable in isolation (no audio device required).

### Key Entities _(include if feature involves data)_

- **Playback speed**: a single multiplier applied to the AI-TTS audio stream; ranges over the supported band, defaults to 1×, persists across sessions. The only new/changed user-facing state; replaces the current 0.5–2.0 clamp with the extended, pitch-preserving band.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001 (pitch held)**: For a known reference tone played at 0.5×, 1×, 2×, and 4.5×, the measured fundamental frequency stays within **≤ 3% (≈ half a semitone)** of the 1× fundamental at every speed. _(Spectral measurement on synthesized audio — the headless gate.)_
- **SC-002 (tempo scales)**: For the same reference signal, output duration equals input-duration ÷ speed within **≤ 2%** at each tested speed.
- **SC-003 (transparent 1×)**: At 1.0× the processed output is bit-identical to, or perceptually indistinguishable from, the unprocessed signal (no added latency beyond one buffer).
- **SC-004 (intelligible fast)**: At 4.5×, a listener correctly transcribes **≥ 90%** of words in a standard sample (one-time human validation, recorded once).
- **SC-005 (range reachable)**: The speed control lets a user select any value across 0.5×–4.5× and the chosen value is restored after restart, with **zero** instances of the old 2.0× cap blocking selection.
- **SC-006 (sync preserved)**: After a mid-playback speed change, the karaoke highlight index matches the expected word at the new speed on a controlled clock with **0** drift beyond one animation frame.

## Out of Scope

- Native-TTS (OS speech engine) rate handling — already engine-side.
- Independent **pitch shifting** (changing pitch without changing tempo) — this feature holds pitch constant; deliberate pitch control is a separate concern.
- Per-voice or per-document speed memory — a single global speed persists, as today.
- Real-device audio-quality tuning of the DSP (artifact polish) beyond the intelligibility bar in SC-004.

## Assumptions & Decisions

- **Max speed = 4.5×** is taken as decided (per the project backlog: "speed 2×–4.5× pitch-preserving"). If product wants a different ceiling, only FR-001/SC-005 change.
- **Pitch tolerance ≤ 3%** and **intelligibility ≥ 90% @ 4.5×** are set as defensible quality bars; they are tunable in planning without reshaping the feature.
- The **HOW** (which time-stretch algorithm/library, buffer sizing, where the transform sits as a player source) is intentionally deferred to `plan.md`.
