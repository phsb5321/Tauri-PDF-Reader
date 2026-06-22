# Phase 0 Research: Pitch-Preserving Time-Stretch for the rodio AI-TTS path

**Date**: 2026-06-21 · **For**: `plan.md` (spec 039)
**Method**: web research routed through the self-hosted SearXNG instance; crate metadata read from the crates.io API; APIs verified by shallow-cloning the actual repos.

## Decision

**Use `signalsmith-stretch` v0.1.3 (colinmarc) as the time-stretch engine**, wrapped in a custom `rodio::Source`. Pure-Rust `timestretch` 0.4.0 is the documented fallback.

## Why (the question that drove this)

rodio has **no** pitch-preserving speed control. Confirmed from its docs: `Sink::set_speed` / `Source::speed` _"Does not adjust the samples, only the playback speed. Increasing the speed will increase the pitch by the same factor."_ — pure resampling → chipmunk. So a real time-stretch DSP stage must be inserted into the playback path.

## Candidate landscape (evidence-backed)

| Crate                                 | Ver             | License                          | Maintained                      | True time-stretch (tempo≠pitch)?                                           | Streaming API?                                                                                            | Verdict                                                                   |
| ------------------------------------- | --------------- | -------------------------------- | ------------------------------- | -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| **`signalsmith-stretch` (colinmarc)** | 0.1.3 (2025-09) | **MIT** (wrapper + upstream C++) | **Active** (commit ~2026-06-12) | **Yes** — Signalsmith STFT/phase algo                                      | **Yes** — `process(input, output)` where `in.len ≠ out.len` sets the stretch; `reset`/`flush`/`*_latency` | **CHOSEN**                                                                |
| `timestretch` (robmorgan)             | 0.4.0 (2026-03) | MIT                              | semi-active                     | Yes — hybrid phase-vocoder + WSOLA, only dep `rustfft`                     | Yes — `StreamProcessor`                                                                                   | **FALLBACK** (pure-Rust, no C++; "EDM-optimized" → validate speech @4.5×) |
| `soundtouch` (Cyanistic)              | 0.5.4 (2026-03) | **LGPL-2.1** ⚠️                  | Active                          | Yes — WSOLA `set_tempo`                                                    | Yes — FIFO `put`/`receive`                                                                                | **Rejected** — LGPL relink obligation on an MIT desktop binary            |
| `rubato`                              | 3.0.0           | MIT                              | very active                     | **No** — sample-rate **resampler** (would shift pitch if abused for tempo) | n/a                                                                                                       | **Rejected** — wrong category                                             |
| `ssstretch`                           | 0.1.0           | MIT                              | **abandoned** (repo deleted)    | Yes                                                                        | unconfirmed                                                                                               | **Rejected** — superseded by colinmarc's crate                            |

## Chosen-path facts

- **License**: MIT all the way down (Colin Marc's wrapper + Geraint Luff's upstream Signalsmith Stretch are both MIT). No copyleft. Compatible with the project's MIT/Apache-2.0 posture.
- **Streaming**: `process(input, output)` feeds N samples and returns a different-length buffer; state persists across calls. Suitable for pulling decoder chunks → stretch → push to sink in a loop. f32 interleaved.
- **Quality**: regarded as on par with / above Rubberband for voice and handles extreme ratios — directly relevant to the 4.5× intelligibility goal (SC-004).
- **Latency**: reports `input_latency()`/`output_latency()`; `flush()` drains the tail.

## ⚠️ Build-dependency risk (drives a CI change → Pedro-gated)

`signalsmith-stretch` compiles vendored C++ at build time via `cc` + generates bindings via `bindgen`, so **every clean build needs a C++14 toolchain + libclang**.

- **Dev (this NixOS host)**: already satisfied by the Tauri toolchain / nix-shell.
- **CI (`.github/workflows/ci.yml`, Ubuntu)**: currently installs `libwebkit2gtk-4.1-dev … pkg-config` — it does **NOT** install clang/libclang. The Backend + Contract jobs will fail to build `signalsmith-stretch` until `clang libclang-dev` (or `llvm-dev`) is added to the `apt-get install` lines.
- **Consequence**: the implementation will touch `.github/workflows/ci.yml`. Per Merge-Ownership that PR (or the workflow-only slice of it) is **Pedro-gated** (changes to `.github/workflows` are not self-merge class). Plan splits this out (see plan.md "Risks & gating").

**Escape hatch**: if the CI/build C++ dependency is unwanted, switch to `timestretch` (pure-Rust, only `rustfft`) — **no `ci.yml` change, no clang** — at the cost of a younger, speech-unvalidated stretcher. The architecture (a `rodio::Source` wrapper behind `AudioSink`) is identical for both, so the engine is swappable with a localized change. Decision recorded; primary remains signalsmith per the user's direction.

## rodio integration shape (0.20)

Implement the `rodio::Source` trait (an `Iterator<Item = f32>` + `current_frame_len` / `channels` / `sample_rate` / `total_duration`) wrapping the MP3 `Decoder`. The wrapper reports the **original** `sample_rate()`/`channels()` and does the tempo change internally in `next()` (buffer decoded samples → `stretcher.process()` at the target ratio → yield stretched samples). rodio then plays at the native rate → pitch is untouched while duration changes.
