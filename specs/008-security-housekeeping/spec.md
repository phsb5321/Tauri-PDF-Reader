# Spec 008 — Security Scope Tightening + Metadata Housekeeping

**Status:** In progress
**Branch:** `008-security-housekeeping`
**Base:** `origin/main` @ 7c5de09 (Lectrice rebrand, PR #5)
**Author:** Pedro H S Balbino (agent-assisted)
**Date:** 2026-05-30

## Problem

Lectrice ships with whole-disk Tauri permissions and stale build metadata left
over from the pre-rebrand "VoxPage / Tauri PDF Reader" era.

1. **Whole-disk asset protocol scope.** `tauri.conf.json` set
   `app.security.assetProtocol.scope = ["**/*"]`. The asset protocol is **never
   used** by app code (no `convertFileSrc`, no `asset.localhost`; PDFs load via
   `plugin-fs` `readFile` -> bytes -> `pdf.js getDocument({data})`). Dead config
   granting unnecessary whole-filesystem read exposure through the protocol.
2. **Whole-disk fs scope.** `capabilities/default.json` set `fs:scope` allow
   `[{ "path": "**/*" }]` — far broader than a local document reader needs.
3. **Unguarded backend file ingest.** Custom Tauri commands run native
   `std::fs` and therefore BYPASS the plugin-fs capability scope entirely.
   `library_add_document` / `library_relocate_document` call `compute_file_hash`
   which `File::open`s and reads ANY path passed over IPC. A compromised WebView
   could hash `/etc/passwd` (content/guess oracle) or hang forever on
   `/dev/zero` (a regular read never returns 0 bytes) — a DoS. (Surfaced by
   Codex adversarial review; pre-existing, not introduced here.)
4. **Stale metadata.** `Cargo.toml` `authors = ["VoxPage"]` + generic
   `description`. `CLAUDE.md` claimed `rodio 0.21+` while `Cargo.toml` pins
   `rodio 0.20`.

## Goals

- Remove the unused whole-disk asset protocol scope.
- Remove the whole-disk fs scope; scope plugin-fs to the app's own data dir.
- Guard the backend file-ingest commands so they only read regular `.pdf`
  files (closing the cross-surface hole that capability scope cannot reach).
- Correct stale identity/version metadata.
- Leave a precise, verified plan for the remaining persisted-scope work.

## Non-goals

- Wiring the dead `pdf-storage-service.ts` copy-into-app-dir flow (separate slice).
- Adding `tauri-plugin-persisted-scope` (needs a GUI build + restart-reopen test; tracked as S2).
- Raising/lowering the coverage threshold (tracked separately; see plan §Coverage).
- pdf.js upgrade, TTS work, or any feature change.

## Verified open/reopen flow (against 7c5de09)

| Step | Code | Surface | Scope need |
|------|------|---------|-----------|
| Pick PDF | `plugin-dialog open()` | dialog | auto-grants `allow_file(picked)` at runtime (Tauri v2, source-verified) |
| Render bytes | `pdfService.loadDocument(picked)` -> plugin-fs `readFile(picked)` | plugin-fs | covered by dialog runtime grant — NOT static scope |
| Add to library | `library_add_document(picked)` -> `compute_file_hash` (native `std::fs`) | custom Rust cmd | NOT gated by fs scope at all -> needs an in-command guard |
| Reopen from library | **not wired**: `LibraryView` exists but is mounted nowhere (`App.tsx` -> `ReaderView` -> `Toolbar` + `PdfViewer` only) | — | no live reopen path; every open goes through the picker |

Because every live PDF open flows through the dialog picker (which grants the
picked path at runtime) and there is no wired library-reopen path, the **static
fs scope is not required for reading user PDFs at all** in the current UI. It is
scoped to the app data dir only.

## Decision

- **Asset protocol scope** `["**/*"] -> []`. Protocol unused; empty scope
  removes the exposure with zero functional risk. (`enable:true` left as-is;
  fully disabling + trimming CSP `asset:` is an optional follow-up.)
- **fs scope** `["**/*"] -> ["$APPLOCALDATA/**"]`. plugin-fs reads of user PDFs
  ride the dialog runtime grant; the static scope is now limited to the app's
  own data directory. `fs:allow-read-file` retained.
- **Backend guard** — `compute_file_hash` now calls `validate_pdf_path`
  (regular-file + `.pdf` extension) before opening any path, so
  `library_add_document` / `library_relocate_document` reject `/dev/zero`,
  `/etc/passwd`, directories, and devices. Unit-tested.
- **Metadata** — Cargo.toml authors/description; CLAUDE.md rodio `0.21+ -> 0.20`.

## Scope of the security claim (precise)

This slice removes whole-disk exposure on the **WebView plugin-fs surface** and
the **asset-protocol surface**, and constrains the **backend file-ingest
surface** to regular `.pdf` files. It is NOT a claim that the app is
exhaustively hardened.

## Hardened in this slice (Codex round 2)

- **Symlink bypass:** `validate_pdf_path` canonicalizes first, so a
  `.pdf`-named symlink to a non-PDF target (`/tmp/x.pdf -> /etc/passwd`) is
  rejected by the resolved-target extension check; the canonical path is opened
  (no TOCTOU). Unit-tested.
- **Existence oracle:** `library_check_file_exists` is gated through
  `validate_pdf_path`, so a maliciously-inserted DB row (e.g. via the SQL
  capability) cannot probe arbitrary path existence.

## Residual risks (documented, tracked — not hidden)

- **S2 (persisted-scope):** if a future slice wires library-click reopen that
  reads a stored ORIGINAL path via plugin-fs (no fresh pick), it will need
  `tauri-plugin-persisted-scope` (register after `tauri_plugin_fs::init()`,
  lib.rs:252) to restore the per-pick grant across restart. Until then, reopen =
  re-pick (re-grants).
- **WebView SQL surface:** the capability grants `sql:allow-execute`/`select`
  to the WebView. A future slice should consider routing all DB access through
  typed commands and dropping raw SQL from the WebView capability. Out of scope
  here; the existence oracle it enabled is closed above.
- **S-provenance (file-picker provenance):** `library_add_document` /
  `library_relocate_document` still hash any readable regular `.pdf` named over
  IPC — the backend cannot distinguish a user-PICKED path from an
  attacker-supplied one (custom commands don't consult the fs-plugin runtime
  grant). The guard removes the dangerous primitives (system files, devices,
  DoS); the residual is bounded (compromised WebView + known sensitive `.pdf`
  path + output is only a stored SHA-256). The complete fix — verify picker
  provenance or route file reads through the fs-plugin-scoped API — is a
  separate architectural slice. Tracked; not claimed fixed here.
- **TOCTOU:** mitigated for the read path — `compute_file_hash` re-stats the
  open fd (`fstat`) before streaming, so a path swapped between validate and
  open cannot turn into a device read. A deterministic race test is impractical
  to unit-test (documented test gap).

## Acceptance criteria

- [x] `assetProtocol.scope` no longer contains `**/*`.
- [x] `fs:scope` no longer contains `**/*` (now `$APPLOCALDATA/**`).
- [x] Backend ingest guarded to regular `.pdf` files; unit-tested.
- [x] First-open preserved (dialog runtime grant; no static-scope dependency for picks).
- [x] No `authors = ["VoxPage"]`; no generic description; CLAUDE.md rodio matches Cargo.toml.
- [x] `cargo check` + targeted backend tests pass (with dist stub).
- [ ] Codex adversarial review re-run; no unresolved BLOCKER/MAJOR.
- [x] Persisted-scope follow-up (S2) spec'd with exact wiring + test steps.
