---
name: lectrice-forward-loop
description: Implementation-first, Spec-Kit-governed, Codex-reviewed forward loop for Lectrice (local-first desktop PDF reader with high-quality TTS). Use for every /loop iteration that advances the project.
---

# Lectrice Forward Loop

Continue Lectrice with implementation-first, Spec Kit governed, Codex-reviewed progress.

## Product target

Lectrice is a local-first desktop PDF reader that reads documents aloud with
high-quality voice, highlighting, auto-scroll/page-turn, persistent progress,
library, caching, and export. The differentiator is reading/listening quality
without subscriptions or surveillance.

## Non-negotiable rules

- Preserve dirty worktree changes. Never reset/stash/clean/checkout unknown dirty files.
- WORKTREE-FIRST: never edit the main worktree. Work in `../tauri-pdf-reader-NNN-slug`.
- Do not push main. Do not open/merge PRs without explicit authorization.
- Do not widen Tauri permissions. Do not keep whole-disk asset/fs scopes without a documented blocker + migration plan.
- Do not bypass hexagonal boundaries. Do not use direct `invoke()` in UI (use typed adapters / tauri-specta bindings).
- Do not leak API keys or document content into source, logs, tests, snapshots, bindings, or docs.
- Do not add telemetry/cloud tracking/analytics/DRM.
- Do not remove local/offline TTS paths while improving cloud TTS.
- Do not lower the coverage threshold silently — ratchet explicitly.
- Run Codex adversarial review for every logical change set.
- Use Spec Kit for significant work. Keep changes focused; no broad formatting-only diffs.

## Verified environment facts (2026-05-30)

- Repo: `phsb5321/Tauri-PDF-Reader`. Local folder `tauri-pdf-reader`. Branded "Lectrice" (PR #5, origin/main 7c5de09).
- `pnpm` at `~/.local/share/pnpm/pnpm` (not on PATH). `cargo` 1.95, `node` v22, `codex` 0.133, `gh`, `nix` present.
- Cargo/Tauri builds need nix-shell packages: `pkg-config openssl alsa-lib gnumake gtk3 webkitgtk_4_1 libayatana-appindicator librsvg speechd`.
- PDF loading path: `@tauri-apps/plugin-fs` `readFile(path)` -> bytes -> pdf.js `getDocument({data})`. NO `convertFileSrc` / asset protocol usage anywhere.
- Library stores the ORIGINAL picked path and reopens via `readFile(originalPath)`. `pdf-storage-service.ts` (copyPdfToStorage/readPdfFromStorage) is DEAD CODE (defined, never called).
- Tauri Builder plugin order in `src-tauri/src/lib.rs`: sql -> dialog -> fs -> shell. persisted-scope MUST register AFTER `tauri_plugin_fs::init()`.
- Tauri v2 JS dialog `open()` auto-grants `fs_scope().allow_file(pickedPath)` at runtime (in-memory, non-persistent). Survives restart only with `tauri-plugin-persisted-scope`.

## Startup inventory every iteration

```bash
pwd; git status --short; git branch --show-current
git rev-parse --show-toplevel; git log --oneline -8
git fetch origin main && git log --oneline main..origin/main   # detect drift
```

Load: `CLAUDE.md`, `docs/agent-backlog-state.md`, relevant `specs/`, `Cargo.toml`,
`Cargo.lock`, `package.json`, `src-tauri/tauri.conf.json`,
`src-tauri/capabilities/default.json`, `src-tauri/src/lib.rs` plugin setup,
frontend adapter/bindings code, and the tests for the touched area.

## Backlog priority ladder

### P0 — housekeeping + security foundation
1. Dirty worktree triage — classify each dirty file (user work / prior-agent artifact / generated / safe-to-edit / unrelated). If the slice conflicts with dirty files, incorporate carefully or stop with the exact conflict.
2. Housekeeping metadata — Cargo.toml authors/description reflect Lectrice; CLAUDE.md dep notes match Cargo.lock (esp. rodio); README naming coherent. No unrelated doc churn. Verify with grep.
3. Tauri security scope tightening — narrow `app.security.assetProtocol.scope` and fs/capability scope while preserving open + reopen. Add `tauri-plugin-persisted-scope` (after fs::init) only if reopen-after-restart needs it and it is build+restart verified. If not safely verifiable in one slice: ship the narrowest safe scope + document the exact remaining task.
4. Coverage gate decision — prefer an explicit ratchet near the current baseline with a TODO to raise it, or add high-value tests. Never silently lower 80%.
5. Bundle/profile smoke — inspect `[profile.release]` (esp. `strip = true`); run a Tauri build or document the exact missing system dependency.

### P1 — marquee UX
6. ElevenLabs stream-with-timestamps adapter (typed model: audio chunk + char alignment; group chars->words; stream-while-caching; deterministic cache key; fixture tests, no live API).
7. Karaoke highlight UI (word under playback head; no per-tick DOM thrash; punctuation/wrap/page-boundary handling; graceful fall back to sentence-level; reduced-motion aware).

### P2 — PDF performance
8. pdf.js 5.x upgrade (TextLayer migration, worker wiring, tests, verify selection/highlights).
9. Render cancellation + virtualization (cancel RenderTask on scroll/nav; keep TTS page logic correct).

### P3 — offline voice + accessibility
10. Kokoro offline voice spike (verify crate+model license; feature-flagged; no big model download in normal build; compare TTFA/quality).
11. Accessibility quick wins (speed 2x–4.5x, pitch, sepia/soft-dark, dyslexia fonts, sleep timer, prefers-reduced-motion, keyboard-accessible playback bar).

### P4 — differentiators
12. Audiobook export hardening. 13. Bionic reading / line focus / reading ruler. 14. Full-text search / OCR (spec first; OCR is large).

## Spec Kit workflow

For every significant slice: locate or create the next-numbered spec under `specs/NNN-slug/`.
Prefer `/speckit.specify -> .clarify (only if blocked) -> .checklist -> .plan -> .tasks -> .analyze -> .implement`.
If slash commands are unavailable, author the equivalent files manually: `spec.md`, `plan.md`,
`tasks.md`, `checklist.md`, plus `risk-register.md` and `rollback.md`. Update tasks/checklist with evidence.

Every checklist must cover: hexagonal boundary compliance, no direct `invoke()`,
Tauri capability/scope impact, secrets/privacy, offline behavior, frontend tests,
backend tests, build/bundle smoke, accessibility impact, rollback, Codex review.

## Verification menu (use real repo commands; nix-shell for cargo/tauri)

```bash
export PATH="$HOME/.local/share/pnpm:$PATH"
pnpm install --frozen-lockfile
pnpm lint && pnpm lint:boundaries
pnpm typecheck
pnpm test -- src/path/to/changed.test.ts      # targeted; avoid full suite unless asked
nix-shell -p pkg-config openssl alsa-lib gnumake gtk3 webkitgtk_4_1 libayatana-appindicator librsvg speechd \
  --run 'cd src-tauri && cargo fmt --check && cargo clippy --all-targets --features test-mocks -- -D warnings && cargo test --features test-mocks -j 1'
pnpm tauri build      # or document the exact missing dependency
git diff --check
```

Do not fake build success. If a build cannot run, document the exact missing dependency.

## Mandatory Codex adversarial review

After every logical change set, run Codex (non-mutating). Save the verdict under `.claude/reviews/`.

```text
codex exec --sandbox read-only "You are an adversarial senior reviewer. Review this Lectrice
change set (git diff origin/main...HEAD) for Tauri v2 security/capabilities, local-first privacy,
hexagonal architecture, no-direct-invoke, Rust/TS correctness, file open/reopen behavior,
asset/fs scope safety, persisted-scope ordering, generated binding drift, build/profile risk,
coverage honesty, and docs accuracy. Attack for whole-disk exposure, broken library reopen,
API-key leakage, over-broad capabilities, missing tests, release breakage. Return BLOCKER,
MAJOR, MINOR, TEST GAPS, VERDICT. Do not edit files."
```

Rules: any unresolved BLOCKER/MAJOR means NOT done. Fix or document an evidence-based false
positive. If code changes after review, rerun relevant tests + Codex. If Codex is unavailable,
record the blocker and treat internal review as partial coverage only.

## State update (end of every iteration)

Update `docs/agent-backlog-state.md` with: date/time, branch/head, dirty files preserved,
selected slice, files changed, Spec Kit artifacts, commands run, verification results,
security impact, coverage impact, Codex review path/verdict, remaining risks, next slice.

## Done criteria

Done only when: repo safety checked; Spec Kit/equivalent artifacts updated; implementation
OR an exact blocker produced; tests/checks run; security/privacy impact assessed; Codex review
run; state updated; git status summarized. Do not end with "ready to implement" — implement the
selected slice.
