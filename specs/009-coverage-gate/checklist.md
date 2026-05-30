# Checklist 009 — Coverage Gate

- [x] **Hexagonal boundaries** — no source change (config + docs only).
- [x] **No direct `invoke()`** — n/a, no app code touched.
- [x] **Tauri capability/scope impact** — none.
- [x] **Secrets/privacy** — none; no paths/keys.
- [x] **Offline behavior** — unaffected.
- [x] **Coverage honesty** — threshold change is EXPLICIT + ratcheted to the
      measured baseline + documented (`docs/coverage-budget.md`); branches not
      lowered; target stays 80. Not a silent lowering.
- [x] **Frontend tests** — `pnpm test:coverage` rc=0, 486/486 pass, gate green.
- [n/a] **Backend tests / build** — no Rust/Tauri change.
- [x] **Accessibility impact** — none.
- [x] **Rollback** — single `git revert` / restore four `80`s. See spec.md.
- [ ] **Codex review** — pending; no unresolved BLOCKER/MAJOR at close.
