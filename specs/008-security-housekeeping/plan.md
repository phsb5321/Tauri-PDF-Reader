# Plan 008 — Security + Housekeeping

## Approach

Smallest surgical diff that removes whole-disk exposure and stale metadata
without breaking the verified open/reopen flows. No Rust dependency changes in
this slice (persisted-scope deferred to S2 with its own runtime verification).

## Changes

### C1 — Asset protocol scope (tauri.conf.json)
`app.security.assetProtocol.scope`: `["**/*"]` -> `[]`.
Safe because no code uses `convertFileSrc`/asset protocol (grep-verified).
Leave `enable: true` and CSP untouched (minimal diff; CSP `asset:` entries are
harmless with an empty scope and avoid a larger CSP refactor).

### C2 — fs scope (capabilities/default.json)
`fs:scope.allow`: `[{ "path": "**/*" }]` -> `[{ "path": "$APPLOCALDATA/**" }]`.
Retain `fs:default`, `fs:allow-read-file` (command permission, orthogonal to scope).
Safe because (a) every live PDF open goes through the dialog picker, which
runtime-grants the picked path, and (b) `LibraryView` is mounted nowhere, so no
wired path reads a stored original path via plugin-fs. The static scope is thus
needed only as the app's own data-dir sandbox.

### C3 — Cargo.toml metadata
- `authors = ["VoxPage"]` -> `["Pedro H S Balbino"]`
- `description = "A PDF reader with highlighting and text-to-speech"` ->
  `"Lectrice — a local-first desktop PDF reader with highlighting and high-quality text-to-speech"`
- Leave `name`/lib name unchanged (internal identifiers; renaming risks build/bundle references — out of scope).

### C4 — CLAUDE.md
`rodio 0.21+` -> `rodio 0.20` on both occurrences (lines ~310, ~315). Matches Cargo.toml.

### C5 — Backend file-ingest guard (db.rs + mod.rs)
Add `validate_pdf_path(file_path) -> PathBuf` that canonicalizes the path
(resolving symlinks), then requires a regular file whose RESOLVED name ends in
`.pdf` (case-insensitive), returning the canonical path. Call it:
- at the top of `compute_file_hash` (the chokepoint shared by
  `library_add_document` + `library_relocate_document`), opening the canonical
  path it returns (no TOCTOU);
- in `library_check_file_exists` (`exists = validate_pdf_path(..).is_ok()`).

Closes the Codex BLOCKER (arbitrary `std::fs` read on the custom-command
surface that fs scope cannot reach) and both round-2 MAJORs: `/dev/zero`
(infinite-read DoS), `/etc/passwd` and non-`.pdf` files (hash oracle), symlink
masquerade (`/tmp/x.pdf -> /etc/passwd`), directories/devices, and the
SQL-insert existence oracle. 8 unit tests cover accept/reject/symlink/uppercase
paths and a fixed SHA-256 (`sha256("hello")`).

## Coverage (decision recorded, no code change this slice)

vitest.config.ts pins all four thresholds at 80%; actual is well below (snapshot
~42%). main currently fails the gate but branch protection does not block on it.
DECISION: do not touch thresholds in this security slice. The honest options —
(a) ratchet to the measured baseline with a documented TODO, or (b) add tests —
are a dedicated P0#4 slice. Recorded here to avoid silent drift.

## Verification

1. Frontend: `pnpm lint`, `pnpm lint:boundaries`, `pnpm typecheck`. No frontend
   source changed, so behavior is unchanged; checks guard against config typos.
2. Backend: `cargo fmt --check`, `cargo check` (nix-shell). No Rust source
   changed; config-only.
3. Capability/config validity: `cargo check` validates capability JSON against
   the generated schema at build time; a malformed scope fails the build.
4. Full `pnpm tauri build` + manual open/reopen is the ideal gate but is
   GUI/-build-env gated — run if feasible, else document the exact blocker.
5. Codex adversarial review on the diff.

## Rollback

Revert is a single `git revert` of the slice commit; all changes are
config/metadata/docs with no schema or data migration. See `rollback.md`.

## Follow-ups

- **S2 (next slice):** add `tauri-plugin-persisted-scope`. Cargo dep
  `tauri-plugin-persisted-scope = "2"`; register in `src-tauri/src/lib.rs`
  AFTER `tauri_plugin_fs::init()` (currently line 252); then narrow static fs
  scope to `$APPLOCALDATA/**`. MUST verify with a GUI build + pick-file ->
  restart -> reopen test. Closes the out-of-`$HOME` reopen residual.
- **S3 (optional):** either delete the dead `pdf-storage-service.ts` or wire it
  so reopen reads a stored copy from `$APPLOCALDATA/pdfs/**` (then fs scope can
  drop `$HOME/**` entirely — the most secure end state).
