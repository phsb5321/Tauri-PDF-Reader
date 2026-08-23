# Security

This document is grounded in the code it describes. Every claim carries a
citation; if a sentence cannot be checked, it does not belong here. The
dataflow map is enforced by `src/__tests__/architecture/security-dataflow-contract.test.ts`
— a new outbound network call without an update to this document and that
test turns CI RED.

## Supported versions / reporting

Single-main-branch desktop app; the only supported version is the current
`main` tip (and its packaged release). Security issues: open a GitHub issue
or a private security advisory on this repository. No bug bounty, no paid
program.

## Dataflow map — what leaves the device

| What                                                | To whom                                                          | Triggered by                                                                                                                                          | Code                                                                                                                 |
| --------------------------------------------------- | ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| PDF-derived page text (the page you ask to be read) | ElevenLabs (`https://api.elevenlabs.io/v1`)                      | Any TTS speak action while the default ElevenLabs provider is selected: Play, resume-and-play, auto-page continuation, or prebuffer                   | `src-tauri/src/ai_tts/elevenlabs.rs` (reqwest client; optional `elevenlabs-tts` feature)                             |
| PDF-derived page text (the page you ask to be read) | The exact user-operated loopback service `http://127.0.0.1:5301` | Play, resume-and-play, or auto-page continuation while native config explicitly selects `provider = "local"`; local mode never prebuffers before Play | `src-tauri/src/adapters/local_tts.rs` (bounded reqwest client, exact destination whitelist, idempotent WAV contract) |

Nothing else makes an outbound network call. PDF CMap tables were the
second egress (jsDelivr CDN) until slice 100 bundled them into the app
(`node_modules/pdfjs-dist/cmaps` → `public/cmaps` at build time); the CSP
no longer permits any third-party host. Telemetry rows exist in the
settings store (`telemetry.analytics` / `telemetry.errors`,
`src/lib/db-init.ts:246-247`) but **no sender exists** — toggling them
changes nothing on the wire. There is no crash-reporting, analytics or
update-check egress.

The in-app disclosure names the selected destination. ElevenLabs mode states
that requested PDF-derived text leaves the device for ElevenLabs. Local mode
prints the exact loopback URL and states that text goes there and not to
ElevenLabs (`src/components/playback-bar/AiTtsSettings.tsx`).

**Diagnostics:** the debug-logs surface (`DebugLogs.tsx`, fed by
`get_debug_logs`/`export_debug_logs`) redacts at the export boundary —
user paths (`/home/<redacted-user>/…`) and secret-shaped tokens
(`sk_<redacted>`) cannot survive into display or clipboard
(`src-tauri/src/services/logging.rs`, `redact_text`). The surface's in-memory
buffer has no producers today (verified 08/08: zero callers of the `log_entry`
helpers outside that module), so this is a guard for the moment it gains some.

## Secrets

The ElevenLabs API key is **session-only by design** (#73):

- It is excluded from persisted state — `partialize` stores only
  `selectedVoiceId`, `speed`, `autoPageEnabled`
  (`src/stores/ai-tts-store.ts:240-244`); legacy persisted keys are stripped
  by `migrate`/`merge` before application effects can see them.
- It lives only in WebView memory for the current process; a reset clears it;
- Cost of the design: narration is unavailable on every fresh launch until
  the key is re-entered. The reading home says so explicitly when no key is
  configured (`src/components/library/ResumeSection.tsx`), and the playback
  bar's setup prompt offers Configure.

The key travels to ElevenLabs over TLS as the bearer credential of the
requests in the dataflow table above. It is never written to the SQLite
database, the TTS cache, or the settings store. Local mode requires no API key;
its provider and exact loopback URL come from the read-only native config, and
no WebView command can mutate that destination. A local dispatch never falls
through to ElevenLabs.

## Local retention

| What                                                                           | Where                                                                                                           | Cleared by                                                                                                                                                                                                                                      |
| ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Library metadata, highlights, sessions, settings, TTS-cache metadata           | SQLite database in the app data dir (`src-tauri/src/db/migrations.rs:86-87`)                                    | Deleting a document removes its row (`src-tauri/src/commands/library/mod.rs:271`); there is no whole-database wipe UI                                                                                                                           |
| Cached TTS audio (SHA256-keyed by provider/revision/text/voice/settings/media) | `{app_cache_dir}/tts_cache/` (`.mp3` for ElevenLabs, `.wav` for local; `src-tauri/src/adapters/audio_cache.rs`) | Settings → AI TTS Settings → **Clear Cache** (`ai_tts_cache_clear` → `AudioCacheAdapter::clear`) counts and removes both formats; per-document and per-voice invalidation exist (`audio_cache_clear_document`, `ai_tts_cache_invalidate_voice`) |

Known gap: per-file removal failures during document delete are silently
swallowed (`let _ = std::fs::remove_file` in
`src-tauri/src/adapters/sqlite/audio_cache_repo.rs`, `delete_for_document`),
so an unreadable or locked `.mp3`/`.json` could orphan on disk while its
metadata row still drops. The happy path removes BOTH the files and the
metadata (behavioral Rust test
`delete_for_document_removes_files_and_drops_stats`; packaged proof:
`e2e/delete-journey.e2e.mjs`).

## Threat model — and the gaps it names

This app runs a WebView plus a Rust backend with direct filesystem and
database access; the model below assumes the WebView is the attacker-chosen
entry surface (untrusted PDF content, XSS).

- **Tauri's fs scope does not constrain the Rust backend.** The fs-plugin
  scope (`$APPLOCALDATA/**` plus per-file runtime grants,
  `src-tauri/capabilities/default.json`) governs only the fs _plugin_ JS
  API. Custom command handlers read arbitrary user-named paths with their
  own validation: `compute_file_hash` canonicalizes, checks the `.pdf`
  extension and re-stats the opened fd (`src-tauri/src/commands/library/db.rs:61-71`)
  but is not bound by the plugin scope. This is stated verbatim in the
  executable security contract: `src/__tests__/architecture/tauri-security-contract.test.ts:15-23`
  ("A green run here says the declared surface has not widened; it says
  nothing about what those command handlers touch."). The gap is accepted
  and tested, not hidden.
- **The asset protocol is enabled with an empty scope**
  (`src-tauri/tauri.conf.json:28-30`), and `shell:allow-open` permits opening
  external links (the ElevenLabs site link in the settings UI) in the default
  browser — the app transmits no data in that action.
- **Highlights are readable out-of-process.** The `v_highlight_citations`
  view (`src/lib/db-init.ts:221-238`) exposes highlight text, notes and the
  source document's path/title; a contract test asserts that external tools
  can `SELECT` from it directly (`src-tauri/tests/frontend_schema_contract.rs:363-385`).
  Anyone with read access to the SQLite file (same user, same machine) can
  read your highlights without going through the app.
- **Offline reading is fully offline.** PDF CMap tables are bundled into
  the app at build time (`node_modules/pdfjs-dist/cmaps` → `public/cmaps`,
  vite plugin in `vite.config.ts`), so PDFs whose fonts need CMap data
  render with no network. The only egress left is one of the explicitly
  selected AI-TTS text paths documented above.
- **CodeQL covers the TypeScript surface only; Rust is out of scope**, and
  the CSP requires `'unsafe-eval'` for pdf.js (`src-tauri/tauri.conf.json:26`).
  These are known, deliberate boundaries, recorded in the ops-parity gap
  matrix rather than silently accepted.
