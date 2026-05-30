# Checklist 012 — Release / Bundle Smoke

- [x] **Hexagonal boundaries** — no code change (verification + docs).
- [x] **No direct `invoke()`** — n/a.
- [x] **Tauri capability/scope impact** — none (no scope change).
- [x] **Secrets/privacy** — none.
- [x] **Offline behavior** — unaffected.
- [x] **Build/bundle smoke** — `cargo build --release` PASS (rc=0, 15MB stripped); full bundle blocked on absent `linuxdeploy`/`appimagetool`/`cargo-tauri` (documented, not a defect; narrow-targets/provision-toolchain recommended).
- [x] **WebKit env** — research DMABUF suggestion evaluated; inapplicable (no change), evidence in spec.
- [x] **Codex review** — valid; no BLOCKER/MAJOR against the slice; 2 wording MINORs fixed.
- [n/a] **Tests** — verification slice; no logic added.
- [x] **Accessibility impact** — none.
- [x] **Rollback** — no code change.
