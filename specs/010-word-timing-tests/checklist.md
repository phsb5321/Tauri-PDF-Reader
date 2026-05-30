# Checklist 010 — Word-Timing Tests

- [x] **Hexagonal boundaries** — test added to existing `ai_tts` module; no boundary crossed.
- [x] **No direct `invoke()`** — n/a (backend tests).
- [x] **Tauri capability/scope impact** — none.
- [x] **Secrets/privacy** — no API keys; fixtures are synthetic char/time arrays, no live ElevenLabs call.
- [x] **Offline behavior** — unaffected (no production code changed).
- [x] **Backend tests** — 8 new `chars_to_words` unit tests; all pass + clippy clean.
- [x] **Production change** — 1-line offset fix (`char_str.len()` → `encode_utf16().count()`); ASCII byte-identical (no regression), non-ASCII corrected to match the JS/DOM consumer.
- [n/a] **Frontend tests / build** — backend offset fix; frontend consumer unchanged. End-to-end non-ASCII DOM highlight is GUI-gated (residual).
- [x] **Accessibility impact** — none.
- [x] **Rollback** — `git revert` (test-only).
- [ ] **Codex review** — pending; no unresolved BLOCKER/MAJOR at close.
