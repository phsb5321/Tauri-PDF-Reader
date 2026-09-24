# TTS-WER round-trip — design (skeleton; runner not implemented yet)

Slice `296-measurement-skeleton` (23/09/2026). This file is the **contract** the runner must
implement; a change to either lands in the same PR. No runner code exists yet — the first
implementation slice drops in `tools/tts-wer-roundtrip/` and must match §5 or amend this file.

Purpose: prove that what the voice **actually speaks** matches the intended spoken form —
catching misnormalizations, omissions, repeats, and silently dropped chunks. This is the third
rung of the four-rung ladder (extraction WER → spoken-form pairs → TTS-WER round-trip → human
listening) and it is an **omission / intelligibility diagnostic only**. Per FR-010
(`specs/188-source-aligned-prosody/spec.md`, "Objective audio/ASR measurements MUST NOT be
described as human preference") nothing measured here may be called "sounds better" — that
verdict belongs to the human prosody protocol alone.

Local-first is a hard constraint: every stage runs offline. Cloud providers are optional
inputs, labelled `cloud` in every report, and never part of a gate.

---

## 1. Pipeline

```text
intended spoken text → [synth: provider under test] → WAV → [ASR: pinned whisper-class] → transcript → [fold + score] → report
```

1. **Intended spoken text** — output of the spoken-form plan (source→spoken, range-preserving),
   never raw display text. Display text must stay byte-identical to the PDF source for
   highlight mapping; the round-trip always scores the **spoken** side. Sources: the
   spoken-form pair corpus (`tests/spoken-form-corpus.ts`, test-only slice 295) and the
   `spoken` units of the hand-checked fixture sidecars (§2).
2. **Synth** — provider under test through its existing local surface: `magpie`
   (`tools/magpie/lectrice_magpie_bridge.py`), `kokoro`, or the in-app engines (`local`,
   `elevenlabs`, `groq` — the cloud two need a session key and are optional). Output: PCM16 WAV.
3. **ASR** — whisper-class, fully local: `faster-whisper` or `whisper.cpp`. Model name,
   quantization and sha256 pinned in `toolchain.lock` (§4). Language hint `en` / `pt`.
4. **Score** — §3.
5. **Report** — §5.

## 2. Fixture inputs (two sources, one corpus root)

| Source                    | What it gates                                                  | Layout                                    |
| ------------------------- | -------------------------------------------------------------- | ----------------------------------------- |
| spoken-form pairs         | normalization correctness (numeric-critical subset first)      | `tests/spoken-form-corpus.ts` (slice 295) |
| hand-checked PDF fixtures | real-book extraction targets, `spoken` units, 5-min seam clips | `docs/corpus/hand-checked/README.md`      |

Round-trip artifacts (WAV, JSON reports) go to the `--out` directory — local scratch or
release evidence. They never enter the corpus root and never enter git.

## 3. Scoring contract

- **Fold** (deterministic, applied to BOTH sides before comparison): NFC → casefold →
  punctuation strip → whitespace collapse. **No de-hyphenation in the fold** — hyphen joins
  are a measured error class, not a courtesy.
- **Token WER** (Levenshtein over folded tokens) + CER, per input and per class.
- **Per-class counters:**
  - `numericCriticalOK` — the intended number **words** must appear in the transcript in
    order (currency / time / figure-section refs). A misnormalization here is the primary
    failure this rung exists to catch.
  - `droppedChunks` — repeats + omissions at clip joins on the 5-minute seam clip (the
    per-chunk splice failure shape documented in
    `docs/research/narration-performance-sota-20260829.md`).
  - `misreads` — residual WER after the two counters above.
- **Differential discipline** — absolute WER confounds voice quality with TN quality. The
  gate compares the **same clips across two configs** (before/after): per-clip deltas +
  corpus consistency, never a bare mean.
- **Optional timing arm** — ASR word timestamps vs provider word marks
  (`chars_to_words`, `src-tauri/src/ai_tts/elevenlabs.rs:469`) → median/p95 |Δt| on shared
  words. Diagnostic only: ASR timestamps are themselves estimates — label
  measured-vs-estimated in the report (convention from
  `docs/research/local-tts-sota-20260908.md` §"Minimum comparison" step 6).

## 4. Toolchain lock (anti-inflation)

`tools/tts-wer-roundtrip/toolchain.lock` (JSON): `asr {name, version, model, quant, sha256}`,
`synth {provider, revision}`, `seed`. Every report names: harness git commit + toolchain.lock
sha256 + fixture manifest sha256. A lockfile/environment mismatch exits `2` — never a silent
re-run with unpinned tools.

## 5. CLI + outputs (the runnable shape)

```text
tools/tts-wer-roundtrip/run.sh \
  [--lang en|pt-BR] [--provider magpie|kokoro|local|elevenlabs|groq] \
  [--corpus "$LECTRICE_REAL_PDF_CORPUS"] [--pairs tests/spoken-form-corpus.ts] \
  [--out reports/] [--seed N] [--baseline reports/<previous>.json]
```

- `roundtrip-report.json` — machine-readable: per-input rows
  `{id, lang, class, wer, cer, numericCriticalOK, droppedChunks, driftMedianMs?, driftP95Ms?}`
  - config block + toolchain block.
- `roundtrip-report.md` — summary table + an explicit **"diagnostic, not naturalness"** banner.
- Exit codes: `0` all gates pass · `1` threshold failure · `2` toolchain mismatch ·
  `3` fixture error (missing / changed sha256) · `4` optional provider unavailable (e.g. no
  session key for a `cloud` label — never fatal for an optional input).

## 6. Thresholds (gate 4 of the measurement gate table)

- Differential: `WER(new) ≤ WER(base) + jitter-guard`, where jitter-guard = measured spread
  of 3 identical-config repeat runs at first calibration **[PROPOSED-CALIBRATE — not yet
  measured]**.
- `numericCriticalOK` — zero semantic divergence (number words present, in order).
- 5-minute seam clip — zero dropped chunks.
- Runs are per-release / per-provider-change (CPU/GPU minutes). Never in CI, never in the
  app path: the speed-of-light mandate governs user actions; this harness is batch, offline,
  and blocking nothing.

## Not worth it (this rung)

| Tempting thing                               | Why not                                                                                                                                                 |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Absolute MOS-style claims from this harness  | WER cannot see prosody; FR-010 forbids the claim. Naturalness = human protocol (UTMOS/DNSMOS at most paired-trend diagnostics)                          |
| Cloud ASR as the gate oracle                 | Violates local-first and leaks fixture text to a third party; local whisper-class only                                                                  |
| WhisperX-style forced alignment in this rung | Transcribe-then-align wastes decode when the transcript is known; if word drift needs better boundaries, an align-only CTC sidecar is the correct shape |
| Running the round-trip in CI                 | CPU/GPU minutes per run; the cheap rungs (extraction WER + pair corpus) are the CI gate — this rung is release-scoped                                   |
