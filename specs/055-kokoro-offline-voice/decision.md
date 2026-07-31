# Decision: Kokoro Offline Voice — can it drive Lectrice's karaoke highlight?

**Date**: 2026-07-31 | **Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

## Verdict

**Kokoro's Python pipeline satisfies the karaoke contract. Kokoro's
JavaScript/ONNX port does not, and the gap is 0.44 s of highlight error at
minimum.**

Adoption is therefore gated on shipping the *Python* path — an embedded
interpreter or a sidecar process — not on the WASM port that would otherwise be
the obvious fit for a Tauri app. That is a real cost, and it is the decision
Pedro is actually choosing between; it is not a "looks promising".

Proof: `pnpm exec vitest run
src/__tests__/integration/kokoro-word-timings.test.ts` → **9 passed**, offline,
against committed captures of real Kokoro output.

## What was actually run

Two synthesis runs (kokoro 0.9.4, `hexgrad/Kokoro-82M`, voice `af_heart`,
`lang_code='a'`, 24 kHz), captured once by
[`capture-kokoro.py`](./capture-kokoro.py) and committed:

| Fixture | `cache_key` | Text | Chunks | Audio |
|---|---|---|---|---|
| `kokoro-af-heart-single-chunk.json` | `8fc1e6fd…36c5e3` | `alpha beta gamma delta epsilon` | 1 | 62 400 samples (2.600 s) |
| `kokoro-af-heart-multi-chunk.json` | `cf1d72df…7385b2` | `alpha beta gamma\ndelta epsilon zeta` | 2 | 45 600 + 51 000 samples (4.025 s) |

`cache_key = sha256("kokoro|<lang>|<voice>|<text>")`, so changing the voice, the
language or a single character of the text yields a different key rather than
silently overwriting an existing fixture.

The test suite makes no network call, loads no weights, and opens no audio
device.

Provenance is checkable, not asserted: re-running

```
HF_HOME=<scratch> python specs/055-kokoro-offline-voice/capture-kokoro.py \
  "alpha beta gamma delta epsilon"
```

reproduces `kokoro-af-heart-single-chunk.json` **byte-for-byte** (`sort_keys` +
`ensure_ascii=False`), and likewise for the multi-chunk text. So a reader can
re-derive the evidence rather than take the fixture on trust.

## Finding 1 — Kokoro's timestamps are chunk-relative ✓ verified

This is the load-bearing result, and it is not in Kokoro's documentation.

`KPipeline` splits input on `\n+` and **restarts its clock at zero for every
chunk**. In the multi-chunk capture, chunk 1's first token `delta` reports
`start_ts: 0.3` — even though 1.9 s of audio precedes it.

An adapter that passed raw marks through would highlight `delta` at 0.300 s,
i.e. **before** `alpha` (whose real mark is 0.350 s) has even started. The error
is the full duration of every preceding chunk — 1.9 s here, unbounded in a real
document.

The converter corrects it by adding `Σ audio_samples / sample_rate` of the
preceding chunks:

| Token | Raw `start_ts` | Converted `startTime` |
|---|---|---|
| alpha | 0.350 | 0.350 |
| beta | 0.675 | 0.675 |
| gamma | 0.975 | 0.975 |
| delta | 0.300 | **2.200** |
| epsilon | 0.650 | **2.550** |
| zeta | 1.175 | **3.075** |

Asserted to 6 decimal places in `kokoro-word-timings.test.ts` ("offsets each
chunk by the audio that precedes it"). Negative control NC1 (drop the offset
accumulation) → 4 tests fail.

## Finding 2 — the split separator is in no token ✓ verified

The last token of a chunk carries `whitespace: ""`, so concatenating
`text + whitespace` across chunks yields `"…gammadelta…"` — it does not
reconstruct the source. Character offsets must be re-anchored per chunk by
locating `graphemes` in the original text.

Consequence for any future adapter: `charStart`/`charEnd` cannot be accumulated
across a chunk boundary. Negative control NC2 (single running cursor) → 2 tests
fail, and every offset after the newline is wrong by one character — which in a
PDF means the highlight sits on the wrong glyph for the entire rest of the page.

Offsets are UTF-16 code units, matching what `chars_to_words` emits in
`src-tauri/src/ai_tts/elevenlabs.rs`, so a Kokoro highlight indexes page text
identically to an ElevenLabs one.

## Finding 3 — the highlight index derives from `start_time` ✓ verified

The converted timings were fed through the **shipping** loop —
`useTtsWordHighlight` + `ai-tts:playback-starting` + `useTtsHighlightStore` —
with `performance.now` spied and `requestAnimationFrame` stubbed into a manual
frame queue, mirroring `karaoke-sync.test.ts`. On that controlled clock:

- 0 → 0.300 s (before the first mark): `currentWordIndex === 0`, clamped rather
  than negative.
- For every `i`, the first frame at or after `wordTimings[i].startTime` yields
  `currentWordIndex === i` — including the three words that only line up
  because of the chunk offset.
- 3.760 s (past the last mark's end, inside trailing silence): still index 5,
  still active.
- 4.035 s (past `totalDuration`): the duration guard completes exactly once.

No re-implementation of selection in the test; the production path is the
oracle.

## Finding 4 — the cost of a timestamp-less runtime is 0.44 s ✓ measured

A runtime that returns audio per chunk but no per-token marks can only spread
each chunk's duration across its words. `uniformApproximationError` models the
*generous* version of that (length-weighted, not equal-width) and measures the
worst distance from Kokoro's real **start** marks. Start is the deciding
quantity, not an arbitrary half of the mark: `findWordIndexAtTime` selects the
highlighted word from `startTime` boundaries, so start error is what moves the
highlight onto the wrong word. End error is not measured and is not claimed.

| Fixture | Worst error | As a fraction of its chunk |
|---|---|---|
| single chunk | **0.4433 s** | 17 % of 2.600 s |
| multi chunk | **0.4778 s** | 22 % of 2.125 s |

Both pinned to 3 dp in the test, so a converter regression or a fixture swap is
visible.

For scale: the *shortest* word span in these captures is 0.300 s. The
approximation is off by more than a whole word — it would routinely highlight
the wrong word. And because the model used is the generous one, **0.44 s is a
floor, not a worst case.**

**The bound, in one sentence:** the error cannot accumulate across chunks —
each chunk is re-anchored to real audio length, so drift resets at every chunk
boundary and stays bounded by one chunk's duration (asserted:
`multi < longestChunkDuration`) — but a "chunk" is a `\n+`-delimited segment,
**not a sentence**, so on a PDF paragraph rendered as one line the bound is the
whole paragraph unless the caller passes a sentence-level `split_pattern`.

## What this does NOT establish

- ◐ **That `kokoro-js` specifically lacks per-token marks.** Not re-verified
  here; taken from the port's documented output shape. The measured 0.44 s
  applies to *any* runtime without per-token marks, which is what makes the
  number useful regardless of which port is chosen.
- ◯ **Audio quality, pt-BR coverage, or real-time factor.** Out of scope. Prior
  research (see `handoff/`) measured ~3.3× real time locally; that figure was
  not re-measured by this spike and should not be quoted as current.
- ◯ **That an embedded Python runtime is shippable in Lectrice's bundle.** No
  packaging work was attempted. This is the open cost the verdict hands to
  whoever picks up adoption.

## What an adapter would owe

If Kokoro is adopted, `src/lib/kokoro-word-timings.ts` is the contract to port
into the Rust adapter (or to keep as the frontend-side conversion, if the
sidecar returns raw chunks). The three things it must not lose:

1. Add `Σ audio_samples / sample_rate` of preceding chunks to every mark.
2. Re-anchor character offsets per chunk against the source text.
3. Fail loudly when a chunk's text is not found, rather than emitting offsets
   that point at the wrong characters.

Additionally: pass an explicit sentence-level `split_pattern` to `KPipeline` if
the per-chunk bound matters, and decide what to do with `start_ts: null` tokens
(the converter counts them as `skippedTokens`; both captures have zero, which
the fixture-integrity test asserts, so a future capture containing one changes
that assertion deliberately rather than silently).

## Recommendation

Do not build the adapter on the WASM port. If offline TTS is wanted, the
question to answer next is packaging — can a Python Kokoro sidecar ship inside
the Tauri bundle at acceptable size and start-up cost — and that is a
Pedro-gated product call, not a verification gap.
