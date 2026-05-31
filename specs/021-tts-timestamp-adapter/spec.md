# Spec 021 — ElevenLabs With-Timestamps Wire-Contract Fixtures (P1 #6)

## Problem

P1 slice #6 ("ElevenLabs stream-with-timestamps adapter") is largely already
built: a typed model (`AlignmentData`, `WordTiming`), char→word grouping
(`ElevenLabsClient::chars_to_words`, 8 unit tests incl. UTF-16 offsets from Spec
010), and a deterministic `_ts`-suffixed cache key all exist. A gap analysis
found the one untested, contract-sensitive seam: the **API wire contract** —
deserializing a real `/with-timestamps` JSON body into the typed model. The
existing tests feed hand-built `AlignmentData`; none parse the JSON shape, so a
field-name drift (ours vs ElevenLabs') would go uncaught.

"Stream-while-caching" does not apply to this endpoint (it returns base64 audio
embedded in JSON alongside the alignment, so the full body must be buffered);
that was undocumented.

## Decision

Add fixture tests for the wire contract and document the buffering decision —
all in `src-tauri/src/ai_tts/elevenlabs.rs`, no production behavior change.

1. `with_timestamps_response_deserializes_and_converts_end_to_end` — deserialize
   a realistic `/with-timestamps` JSON (incl. the ignored `normalized_alignment`
   field that the live API returns, proving non-strict deserialization), decode
   the base64 audio, and run `chars_to_words` end to end; assert word strings +
   start/end times + total duration.
2. `with_timestamps_response_tolerates_missing_alignment` — a body without
   `alignment` deserializes to `None` (adapter returns empty timings, no panic).
3. Doc comment on `text_to_speech_with_timestamps` explaining why it buffers
   (base64-in-JSON) and naming the upstream chunked `/stream/with-timestamps`
   endpoint as the future stream-while-caching option.

No live API (pure fixtures), no new deps, no Tauri scope change.

## Verification

- nix-shell: `cargo fmt --check` clean; `clippy --all-targets --features
  test-mocks -- -D warnings` clean; `cargo test --features test-mocks -j 1` →
  both new tests pass, `chars_to_words` suite still green, full backend suite 0
  failed.
- Codex adversarial review: VERDICT PASS, no BLOCKER/MAJOR/MINOR; cross-checked
  the fixture against ElevenLabs docs (`.claude/reviews/021-tts-timestamp-adapter.md`).
  Its TEST-GAP note (add `normalized_alignment`) was applied.

## Rollback

Revert the commit — drops two tests + a doc comment. Zero runtime impact.

## Checklist

- [x] Hexagonal boundaries: N/A (test + doc only).
- [x] No direct `invoke()`: N/A.
- [x] Tauri capability/scope impact: none.
- [x] Secrets/privacy: no API key in fixtures (synthetic data); no live call.
- [x] Offline behavior: N/A (tests run offline by construction).
- [x] Frontend tests: N/A (no frontend change).
- [x] Backend tests: +2 fixture tests; full suite green.
- [x] Build/bundle smoke: cargo fmt/clippy/test green in nix-shell.
- [x] Accessibility impact: none (karaoke a11y handled in #7 UI slice).
- [x] Rollback: documented above.
- [x] Codex review: PASS.

## Notes for the next slice (#7 karaoke highlight UI)

The consumer side (`useTtsWordHighlight`, `TtsWordHighlight.tsx`,
`tts-highlight-store`) already exists. #7 should focus on the UI-quality
requirements not yet verified: no per-tick DOM thrash, punctuation/wrap/page-
boundary handling, graceful fallback to sentence-level, and reduced-motion
awareness — with frontend tests for the word-at-time selection logic.
