# Codex Adversarial Review — 021-tts-timestamp-adapter (P1 #6)

- **Date:** 2026-05-31
- **Commit reviewed:** `99ea8d7` (pre-amend); fixture-realism improvement amended to `409383c`.
- **Tool:** `codex exec --sandbox read-only` (Codex v0.134.0, gpt-5.5)
- **Scope:** `git diff origin/main...HEAD` — `src-tauri/src/ai_tts/elevenlabs.rs` only (two fixture tests + a doc comment).

## Verdict: PASS

**BLOCKER:** none. **MAJOR:** none. **MINOR:** none.

Codex confirmed (cross-checked against ElevenLabs API docs):
- Tests make **no live API / network call** — pure JSON fixtures.
- Fixture fields match the real `/with-timestamps` contract: `audio_base64`, `alignment.{characters, character_start_times_seconds, character_end_times_seconds}`.
- Timing/word assertions match `chars_to_words` semantics (whitespace-terminated word ends at the previous char end; final word ends at the last char end).
- No production behavior change, no new deps, no secrets, no Tauri scope change, hexagonal boundaries intact.
- The doc comment is correctly scoped: the adapter uses `/with-timestamps` (base64-in-JSON); a separate chunked `/stream/with-timestamps` endpoint exists upstream.

### TEST GAP (Codex) — ADDRESSED
Codex noted the real response also contains a `normalized_alignment` block the adapter ignores, and a more realistic fixture could include it to guard against accidental strict deserialization. **Applied in amend `409383c`:** the fixture now includes `normalized_alignment`, proving the typed model tolerates the fuller wire shape (the struct does not `deny_unknown_fields`). The doc comment was also extended to name the upstream `/stream/with-timestamps` endpoint as the future stream-while-caching option.

Codex could not run the Rust tests itself (its sandbox lacked `glib-2.0.pc` for `pkg-config`). Resolved here: build verified in the documented nix-shell — `cargo fmt --check` clean, `cargo clippy --all-targets --features test-mocks -- -D warnings` clean, both new tests pass (`with_timestamps_response_deserializes_and_converts_end_to_end`, `with_timestamps_response_tolerates_missing_alignment`), existing `chars_to_words` suite still green.

Full log: `/tmp/lectrice-021-codex.log`.
