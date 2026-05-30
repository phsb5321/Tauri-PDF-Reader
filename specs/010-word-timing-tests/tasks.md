# Tasks 010 — Word-Timing Tests

- [x] T001 Worktree `010-word-timing-tests` off origin/main (7c5de09).
- [x] T002 Verify word-highlight is already built+wired (useTtsWordHighlight→AiPlaybackBar; TtsWordHighlight→PdfViewer/TextLayer; backend text_to_speech_with_timestamps→chars_to_words).
- [x] T003 Confirm gap: `chars_to_words` (elevenlabs.rs:463) has ZERO tests.
- [x] T004 Add 8 fixture-based unit tests for `chars_to_words` (split/punctuation/multi-space/leading-trailing/newline/empty/final-word/utf16-offsets).
- [x] T004b FIX bug the tests + Codex exposed: offsets were UTF-8 bytes but the frontend consumer (createWordRange) uses UTF-16 code units → `char_index += char_str.encode_utf16().count()`. ASCII unchanged; non-ASCII corrected.
- [x] T005 Verify: dist stub + `cargo fmt --check` + `cargo test chars_to_words` (8 pass) + `cargo clippy --all-targets -- -D warnings` (clean).
- [ ] T006 Codex adversarial review (round 2, post-fix) -> `.claude/reviews/010-*`.
- [ ] T007 Update `docs/agent-backlog-state.md`.
- [ ] T008 Commit on `010-word-timing-tests` (no push without authorization).
