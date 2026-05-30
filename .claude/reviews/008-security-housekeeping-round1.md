# Codex Adversarial Review — Spec 008 (Round 1)

- **Date:** 2026-05-30
- **Tool:** `codex exec --sandbox read-only` (codex-cli 0.133.0)
- **Target:** uncommitted change set on `008-security-housekeeping` vs `origin/main`
- **Verdict:** REQUEST CHANGES (1 BLOCKER, 3 MAJOR)

## Findings (verbatim summary)

**BLOCKER** — Custom Rust commands read arbitrary paths, bypassing fs scope.
`library_add_document` (`commands/library/mod.rs:18`) -> `compute_file_hash`
(`commands/library/db.rs:28`) `File::open`s + hashes any path. Tauri fs scope
gates only the plugin-fs JS API, not custom commands. `invoke("library_add_document",
{ filePath: "/etc/passwd" })` still reads it; `/dev/zero` hangs the hash loop.
`library_relocate_document` (`:346`,`:355`) repeats it. => "whole-disk removed"
claim was false on the backend surface.

**MAJOR**
1. `$HOME/**` still broad (SSH keys, browser profiles, secrets); not "narrowest scope".
2. Docs overstate "library reopen" — `LibraryView.onDocumentSelect` exists but
   `ReaderView` renders only `Toolbar` + `PdfViewer`; no reopen path is wired.
3. `library_check_file_exists` (`:298`,`:306`) is an existence oracle over
   arbitrary stored paths, compounding the backend bypass.

**MINOR** — tasks.md checkboxes stale; asset `enable:true` + CSP `asset:` are
residual config noise (asset protocol confirmed unused, no `convertFileSrc`);
`pdf-storage-service.ts` confirmed dead code.

**TEST GAPS** — no first-open/reopen tests under the new scope; no negative
scope test; no backend test rejecting arbitrary/non-PDF paths; no build evidence.

## Resolution (Round 2 changes)

- **BLOCKER fixed:** added `validate_pdf_path` (regular-file + `.pdf`) at the
  `compute_file_hash` chokepoint covering add + relocate; 6 unit tests.
- **MAJOR-1 fixed:** narrowed fs scope to `$APPLOCALDATA/**` only (live opens use
  the dialog runtime grant; no static-scope dependency for picks).
- **MAJOR-2 fixed:** spec/risk-register corrected — `LibraryView` is unmounted;
  reopen is not a live path; reopen+persisted-scope tracked as S2.
- **MAJOR-3 / MINOR / TEST GAPS:** existence oracle documented (low severity,
  `.pdf`-validated at add); asset `enable:false`+CSP trim noted as optional
  follow-up; backend guard tested; `cargo check` build evidence recorded.
