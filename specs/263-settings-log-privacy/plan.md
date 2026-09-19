# Plan263 — remove generic settings value tracing

15/09/2026. Generator OpenAI; branch/root263 based on35801daa. Explicit per-pane assignment supersedes shared goal collision; no goal-file rewrite.

## Technical Context

Rust2021, existing `tracing`0.1 / `tracing-subscriber`0.3, SQLx0.8 SQLite, Tokio test runtime and existing `SettingsService<SqliteSettingsRepo>`; no new dependency or feature. Current frontend setters target v2 handlers; registered legacy commands write SQLite directly. Both share the same data risk, but not a common implementation. Coordinator explicitly extended263 ownership to the two legacy emission sites, without changing the repair cap.

## Minimal implementation

Delete five DEBUG events that interpolate key/value: repository set+batch, v2 single setter, legacy single+batch setters. Do not replace with keys, hashes, content lengths, new helpers or a configurable redactor. SQL, validation, transactions, IPC return types and errors remain byte-for-byte unchanged. Existing rendering-only typed-setting info logs are outside generic document-bearing settings and untouched.

## One falsifier

`src-tauri/tests/settings_log_privacy.rs` uses a current-thread Tokio test with a thread-local TRACE-enabled capture, an in-memory SQLite schema and real service/repository. Synthetic single/batch/overwrite values must round-trip; invalid known setting remains rejected; none of four sentinel contents may appear in capture. A DEBUG positive control proves logging capture is enabled. A fail-closed source guard covers the uninvoked thin v2 and registered generic legacy handlers, as well as repository instrumentation; the legacy section boundary is explicit. This is runtime repository evidence plus command-source coverage, NOT packaged IPC acceptance.

## Qualification and safety

Source search/hash/metadata only while225 is live. All formatting/compilation/tests/hooks through251; two refused normal closes currently block execution pending operator disposition. Proposed bounded test: `timeout 180s cargo test --offline --locked --features test-mocks --test settings_log_privacy settings_values_are_not_traced -j 1 -- --exact --test-threads=1` from263/src-tauri.251 chooses admission based on existing artifacts; no dependency install, native app launch, provider call or real database. Cold compilation/timeouts are blockers, not green.

Freeze exact files/hashes and send READY once. FullGLM5.3 reviews OpenAI source; normal verification/protected CI/PR remain separate. Max2 measured repairs; none consumed without a failing receipt. No native252 factory wiring or edits to its frozen predecessor. Reversal is one revert PR of the eventual squash; no deployed change now.
