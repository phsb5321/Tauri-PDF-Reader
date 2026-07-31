// Test-fixture DDL only. The database the app actually ships is built by
// `src/lib/db-init.ts` through tauri-plugin-sql; nothing here runs at runtime.
// Gated on `cfg(test)` so that stays true by construction rather than by a
// comment nobody reads — the two copies drifted once already, and the shipped
// profile went without `tts_cache_metadata`, `cache_settings`,
// `reading_sessions` and `session_documents` while these tests passed.
#[cfg(test)]
pub mod migrations;
pub mod models;
