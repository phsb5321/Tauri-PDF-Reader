# Risk Register 008

| ID | Risk | Likelihood | Impact | Mitigation | Status |
|----|------|-----------|--------|------------|--------|
| R1 | Narrowing fs scope breaks first-open of a PDF | Low | High | Tauri v2 dialog `open()` auto-grants `allow_file(picked)` at runtime (source-verified); picked files do not depend on static scope | Mitigated |
| R2 | Reopen-after-restart breaks for out-of-`$HOME` files (USB, `/mnt`, `/tmp`) | Medium | Medium | Documented residual; first-open still works; closed by S2 persisted-scope | Accepted + tracked |
| R3 | Empty asset scope breaks PDF/icon/font loading | Very low | High | No `convertFileSrc`/`asset.localhost` in code; worker + fonts load from app origin/bundle, not asset protocol | Mitigated |
| R4 | Capability JSON typo silently disables fs | Low | High | `cargo check`/build validates capability JSON against generated schema; malformed config fails build | Mitigated by T043 |
| R5 | Cannot run full GUI build/restart test in this env | Medium | Medium | `cargo check` covers config validity; reopen logic reasoned + researched; mark build/restart as ◐ and document exact manual steps | Accepted |
| R6 | Existing library entries (original paths) outside `$HOME` fail reopen after this change | Medium | Low | Same as R2; re-picking re-grants; S2 persists grants | Accepted + tracked |
| R7 | Metadata edit accidentally changes binary/bundle name | Low | Medium | Only `authors`/`description` edited; `name`/lib name left unchanged | Mitigated |
| R8 | Backend custom commands read arbitrary paths (fs scope cannot gate `std::fs`) — DoS hang on `/dev/zero`, content/existence oracle (Codex BLOCKER) | Medium | High | `validate_pdf_path` (regular-file + `.pdf`) at `compute_file_hash` chokepoint; 6 unit tests | Mitigated |
| R9 | `.pdf`-named symlink -> non-PDF target hashed (Codex r2) | Low | Med | `validate_pdf_path` canonicalizes and validates the RESOLVED target's type + extension, then opens the canonical path (no TOCTOU); unit-tested | Mitigated |
| R10 | `library_check_file_exists` arbitrary-path existence oracle, incl. via SQL-insert (Codex r2) | Low | Med | Probe gated through `validate_pdf_path`; returns true only for a real regular `.pdf` | Mitigated |
| R11 | IPC can still hash any readable `.pdf` by path — no picker-provenance check (Codex r3) | Low | Med | Dangerous primitives removed (devices/system files/DoS); residual bounded (compromised WebView + known path + output is a SHA). Full fix = provenance check / fs-scope-routed reads | Accepted + tracked (S-provenance) |
| R12 | TOCTOU between validate and open (Codex r3) | Low | Low | `compute_file_hash` re-stats the OPEN fd (`fstat`) before streaming; the inode hashed is the inode validated | Mitigated |

**Note:** R2/R6 (out-of-`$HOME` reopen) are now moot — fs scope is
`$APPLOCALDATA/**` only and `LibraryView` is mounted nowhere, so there is no
wired library-reopen path; every open goes through the dialog picker (runtime
grant). Reopen wiring + persisted-scope is the S2 follow-up.
