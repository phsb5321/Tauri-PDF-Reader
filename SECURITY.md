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

| What | To whom | Triggered by | Code |
| --- | --- | --- | --- |
| PDF-derived page text (the page you ask to be read) | ElevenLabs (`https://api.elevenlabs.io/v1`) | Any TTS speak action: the playback bar's Play, resume-and-play on the reading home, auto-page continuation | `src-tauri/src/ai_tts/elevenlabs.rs:15,149,230,286` (reqwest client; the crate is optional and gated behind the `elevenlabs-tts` feature, `Cargo.toml:50,73`) |
| PDF CMap tables | jsDelivr CDN (`https://cdn.jsdelivr.net/…/cmaps/`) | Rendering a PDF whose fonts require CMap data; the CSP explicitly permits this host | `src/services/pdf-service.ts:85,117`; `src-tauri/tauri.conf.json:26` (`connect-src … https://cdn.jsdelivr.net`) |

Nothing else makes an outbound network call. Telemetry rows exist in the
settings store (`telemetry.analytics` / `telemetry.errors`,
`src/lib/db-init.ts:246-247`) but **no sender exists** — toggling them
changes nothing on the wire. There is no crash-reporting, analytics or
update-check egress.

The in-app disclosure, word for word (#73): *"Requested PDF-derived text
leaves this device and is sent to ElevenLabs for speech generation."*
(`src/components/playback-bar/AiTtsSettings.tsx:184-186`).

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
database, the TTS cache, or the settings store.

## Local retention

| What | Where | Cleared by |
| --- | --- | --- |
| Library metadata, highlights, sessions, settings, TTS-cache metadata | SQLite database in the app data dir (`src-tauri/src/db/migrations.rs:86-87`) | Deleting a document removes its row (`src-tauri/src/commands/library/mod.rs:271`); there is no whole-database wipe UI |
| Cached TTS audio (SHA256-keyed by text+voice+model) | `{app_cache_dir}/tts_cache/` (`src-tauri/src/adapters/audio_cache.rs:80`) | Settings → AI TTS Settings → **Clear Cache** (`ai_tts_cache_clear` → `AudioCacheAdapter::clear`, `src-tauri/src/adapters/audio_cache.rs:366`); per-document and per-voice invalidation exist (`audio_cache_clear_document`, `ai_tts_cache_invalidate_voice`) |

Known gap: deleting a library document removes its cache *metadata* row but
the on-disk audio file is a separate artifact — orphaned files are not
garbage-collected (ops-parity audit, gap-matrix "removal/cache recovery").

## Threat model — and the gaps it names

This app runs a WebView plus a Rust backend with direct filesystem and
database access; the model below assumes the WebView is the attacker-chosen
entry surface (untrusted PDF content, XSS).

- **Tauri's fs scope does not constrain the Rust backend.** The fs-plugin
  scope (`$APPLOCALDATA/**` plus per-file runtime grants,
  `src-tauri/capabilities/default.json`) governs only the fs *plugin* JS
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
- **Offline reading is not fully offline.** PDFs whose fonts need CMap data
  fetch them from jsDelivr (dataflow table); deny the network and those pages
  fail to render text. The core read path is local, the CMap path is not.
- **CodeQL covers the TypeScript surface only; Rust is out of scope**, and
  the CSP requires `'unsafe-eval'` for pdf.js (`src-tauri/tauri.conf.json:26`).
  These are known, deliberate boundaries, recorded in the ops-parity gap
  matrix rather than silently accepted.
