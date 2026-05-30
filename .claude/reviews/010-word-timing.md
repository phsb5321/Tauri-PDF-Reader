# Codex Adversarial Review — Spec 010 (Word-Timing Tests + UTF-16 Fix)

- **Date:** 2026-05-30
- **Tool:** `codex exec --sandbox read-only` (codex-cli 0.133.0)
- **Final verdict (round 2):** PASS — 0 BLOCKER, 0 MAJOR.

## Round 1 (tests only)
Confirmed tests are non-tautological and assertions match the implementation.
**MAJOR:** the multibyte test pinned a real backend/frontend contract bug —
`chars_to_words` emitted UTF-8 **byte** offsets (`char_index += char_str.len()`)
but the consumer `TtsWordHighlight.createWordRange` uses UTF-16 code units
(`textNode.length`, `Range.setStart/setEnd`). Non-ASCII text (umlauts, accents,
CJK) → wrong/missing word highlight.

## Fix
`char_index += char_str.encode_utf16().count()` — UTF-16 code units. The
multibyte test updated to assert UTF-16 offsets (`"é x"` → é 0..1, x 2..3).

## Round 2 (post-fix)
> BLOCKER: None. MAJOR: None — `encode_utf16().count()` matches JS
> `textContent.length` / DOM `Range`. ASCII unchanged; BMP non-ASCII (é) now
> correct; astral code points (emoji = 2 UTF-16 units) consistent with JS.
> VERDICT: **Pass**.

MINOR (fixed): a test name still said `byte_offsets` → renamed.

## Residual
End-to-end non-ASCII DOM-highlight is GUI-gated (offset math + consumer unit
verified statically). Tracked as a GUI smoke follow-up in spec 010.
