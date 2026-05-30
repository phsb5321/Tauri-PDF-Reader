# Codex Adversarial Review — Spec 008 (Rounds 2–4)

- **Date:** 2026-05-30
- **Tool:** `codex exec --sandbox read-only` (codex-cli 0.133.0)
- **Final verdict (round 4):** PASS — no BLOCKER; only the tracked provenance MAJOR remains.

## Round 2 (after the initial backend guard)
BLOCKER (round 1) confirmed fixed. Two new MAJORs:
1. **Symlink bypass** — `metadata()` follows symlinks but extension was checked
   on the link name; `/tmp/x.pdf -> /etc/passwd` passed.
2. **SQL existence oracle** — WebView has `sql:allow-execute`; insert a row with
   `file_path=/etc/passwd`, call `library_check_file_exists` -> `Path::exists()` leak.

**Fixed:** `validate_pdf_path` now canonicalizes and validates the RESOLVED
target (rejects symlink masquerade), returns the canonical path; opened the
canonical path; `library_check_file_exists` gated through `validate_pdf_path`.
Added symlink-to-non-pdf + uppercase-`.PDF` tests (8 total).

## Round 3 (after symlink + oracle fixes)
Both round-2 MAJORs confirmed fixed. Two new MAJORs:
1. **TOCTOU** — `metadata()` then later `File::open()` not atomic; doc overclaimed "no TOCTOU".
2. **Provenance** — backend hashes any readable `.pdf` named over IPC; cannot
   prove a path was user-picked vs attacker-supplied.

**Fixed (TOCTOU):** `compute_file_hash` re-stats the OPEN fd (`fstat`,
`file.metadata().is_file()`) before streaming — a raced device is rejected.
**Tracked (provenance):** documented as S-provenance residual (spec + R11); the
complete fix (picker provenance / fs-scope-routed reads) is a separate
architectural slice. Evidence: guard removes devices/system-files/DoS; residual
bounded (compromised WebView + known `.pdf` path + output is a stored SHA-256).

## Round 4 (final, scoped)
> BLOCKER: None. MAJOR: tracked provenance only; no additional untracked
> BLOCKER/MAJOR. VERDICT: **Pass** — fstat on the open fd closes the `/dev/zero`
> read-path TOCTOU; rejects more, allows no new path.

MINOR (comment overclaim at db.rs:67) — fixed to precise wording.

## Close-out
- BLOCKERs: 0 unresolved.
- MAJORs: 0 unresolved; 1 tracked architectural follow-up (S-provenance).
- Tests: 8 backend unit tests pass; `cargo check`/`fmt` clean.
