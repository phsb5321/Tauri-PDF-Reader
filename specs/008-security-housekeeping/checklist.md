# Checklist 008 — Security + Housekeeping

- [x] **Hexagonal boundaries** — backend change is inside `commands/library` (adapter layer); no UI/domain boundary crossed. No new cross-layer import.
- [x] **No direct `invoke()`** — no UI code touched; rule unaffected.
- [x] **Tauri capability/scope impact** — asset scope `[]`; fs scope `$APPLOCALDATA/**`; whole-disk removed; `fs:allow-read-file` retained. Compiles via `generate_context!` (cargo check rc=0).
- [x] **Backend file-ingest guard** — `validate_pdf_path` (canonicalize -> regular-file -> `.pdf`) gates `compute_file_hash` (add + relocate) AND `library_check_file_exists`. Blocks `/dev/zero` DoS, `/etc/passwd` hash-oracle, symlink-to-non-PDF, SQL-insert existence oracle. 8 unit tests.
- [x] **Secrets/privacy** — no API keys or absolute private paths committed. Scope uses `$APPLOCALDATA` token, not literal user paths.
- [x] **Offline behavior** — unchanged; no network/TTS path touched.
- [x] **Open flow preserved** — first-open covered by Tauri v2 dialog runtime grant (source-verified); guard accepts regular `.pdf` picks.
- [x] **Reopen flow** — `LibraryView` is unmounted; no live reopen path. Every open goes through the picker (runtime grant). fs scope is `$APPLOCALDATA/**` only; persisted-scope is the S2 follow-up if/when reopen is wired.
- [x] **Backend checks** — `cargo fmt --check` OK; `cargo check` rc=0; `cargo test commands::library::db` 8 passed.
- [n/a] **Frontend tests** — no TS source changed (config/metadata/docs only); `lint:boundaries`/`typecheck` not run (node_modules absent in fresh worktree, zero TS diff).
- [defer] **Build/bundle smoke** — full `pnpm tauri build` is GUI/build-env gated; `cargo check` + dist stub validate config. Tracked for a build-smoke slice.
- [x] **Accessibility impact** — none.
- [x] **Coverage honesty** — threshold untouched; decision recorded in plan.md (not silently changed).
- [x] **Rollback** — single `git revert`; no migration. See rollback.md.
- [ ] **Codex review** — rounds 1+2 run; round 3 pending after MAJOR fixes; no unresolved BLOCKER/MAJOR at close.
