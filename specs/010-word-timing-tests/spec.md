# Spec 010 — Word-Timing Tests + UTF-16 Offset Fix (karaoke core)

**Status:** Implemented
**Branch:** `010-word-timing-tests` (off `origin/main` @ 7c5de09)
**Date:** 2026-05-30

## Problem

Word-level "karaoke" highlighting is already fully built and wired:
`useTtsWordHighlight` (rAF loop) ← `AiPlaybackBar`; `TtsWordHighlight` ←
`PdfViewer`/`TextLayer`; backend `ai_tts_speak_with_timestamps` →
ElevenLabs `text_to_speech_with_timestamps` → `chars_to_words`. (The roadmap
listing word-highlight as future work was based on a stale dossier.)

The core algorithm — `ElevenLabsClient::chars_to_words` (elevenlabs.rs), which
converts ElevenLabs per-character alignment into word timings + character
offsets — had **zero tests**. Adding tests exposed a real bug.

## Bug found + fixed (Codex-confirmed)

`chars_to_words` advanced its offset accumulator with `char_str.len()` — UTF-8
**byte** length. But the only consumer, `TtsWordHighlight.createWordRange`, feeds
`char_start`/`char_end` to DOM `Range.setStart/​setEnd` and compares against
`textNode.length` — i.e. **UTF-16 code units**. For ASCII these are equal (why
it worked), but for any non-ASCII character (German umlauts, Portuguese accents,
CJK, smart quotes) the byte offset exceeds the UTF-16 offset, so every word after
the first non-ASCII character highlights the wrong range or none. A real
correctness bug in the marquee feature for multilingual documents.

**Fix:** advance by UTF-16 code units — `char_index += char_str.encode_utf16().count()`.
ASCII behavior is byte-identical (no regression); non-ASCII offsets now match the
JS/DOM consumer.

## Tests added (8, fixture-based, no live API)

split-on-space (times + offsets), punctuation-attached, multi-space collapse,
leading/trailing whitespace, newline separator, empty input, final-word branch,
and `…_uses_utf16_offsets_matching_js_strings` (the regression guard for the fix:
`"é x"` → `é`=offset 0..1, `x`=2..3).

## Non-goals

- No streaming/cache/UI change. (The audio cache stores word timings; entries
  cached before this fix keep old byte offsets until regenerated on cache miss —
  highlighting-only, no audio impact. Noted in risk register.)

## Verification

`cargo test chars_to_words` → 8 pass; `cargo fmt --check`; `cargo clippy
--all-targets -- -D warnings` → clean. ASCII offsets unchanged (proved by the
all-ASCII tests still passing). Full end-to-end DOM-highlight verification for
non-ASCII text is GUI-gated (the offset math + the consumer's UTF-16 unit are
both verified statically) — flagged as the residual check.

## Rollback

`git revert`. ASCII highlighting is unaffected either way; reverting only
restores the non-ASCII bug.

## Follow-ups

- GUI smoke: open a PDF with accented/CJK text, confirm word highlight tracks
  correctly (the residual verification).
- Consider asserting the spoken-text == text-layer-text alignment end-to-end
  (offsets index the spoken text; the DOM element must hold the same string).
