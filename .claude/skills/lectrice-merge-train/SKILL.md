---
name: lectrice-merge-train
description: Integrate Lectrice's completed Codex-PASS loop branches into a clean local integration branch, verify, run adversarial review, and prepare GUI-gated validation — without pushing or opening PRs.
---

# Lectrice Merge Train Loop

Move Lectrice forward by integrating the completed Codex-PASS branches and preparing GUI-gated validation.

## Priority order

1. Preserve dirty main and 018-render-perf.
2. Verify 019→026 branch availability and hashes.
3. Create a clean local integration branch (separate worktree).
4. Merge 019→026 oldest-first.
5. Resolve conflicts carefully.
6. Run checks.
7. Run Codex review.
8. Prepare GUI validation checklist.
9. Decide 018-render-perf integration strategy.
10. Only then consider P2 pdf.js/render performance backlog.

## Non-negotiable rules

- Preserve user work.
- Do not push.
- Do not open PRs without explicit approval.
- Do not merge remote main.
- Do not reset/restore/stash/clean before preserving patches.
- Do not drop 016/017 without approval.
- Do not claim GUI validation without an actual GUI run by Pedro.
- Do not skip Codex.
- Do not start new feature work while the merge train is unresolved.
- Do not break hexagonal architecture or the direct-`invoke()` ban.
- Do not widen Tauri scopes.

## Ground truth (verified 2026-05-31)

- Product name: **Lectrice**. Repo: `tauri-pdf-reader`. Remote: `git@github.com:phsb5321/Tauri-PDF-Reader.git`.
- `origin/main` = **8c366d7** (`test(015) … (#13)`). Local `main` is at `6ccf946` **behind 9** and **dirty** (accidental deletions + generated files) — leave it untouched.
- The 8 branches are **NNN-prefixed** and each is its own worktree (`../tauri-pdf-reader-0NN-slug`). All branch cleanly off `8c366d7`. Each = `origin/main` + impl commit + `docs(NNN)` + (019 only) `spec` commit:

  | #   | branch                      | impl commit | delivers                                               |
  | --- | --------------------------- | ----------- | ------------------------------------------------------ |
  | 019 | `019-coverage-ratchet`      | `42e5825`   | vitest floors 42/53/80/42 → 46/59/88/46                |
  | 020 | `020-persisted-scope`       | `42c1ef8`   | S2: persist fs scope, picked PDF reopens after restart |
  | 021 | `021-tts-timestamp-adapter` | `409383c`   | ElevenLabs with-timestamps wire-contract fixtures      |
  | 022 | `022-karaoke-ui`            | `612188e`   | pure `findWordIndexAtTime`, unit-tested                |
  | 023 | `023-reduced-motion`        | `2e1db32`   | scroll honors `prefers-reduced-motion`                 |
  | 024 | `024-karaoke-fallback`      | `954bdd5`   | pure sentence-fallback timing builder                  |
  | 025 | `025-page-boundary`         | `f1c0619`   | page-straddle word-range fix (`resolveCharRange`)      |
  | 026 | `026-audio-duration`        | `3ab99a1`   | `isPlaybackComplete` zero-duration guard               |

- Integration worktree: `../tauri-pdf-reader-merge-train`, branch `integrate/019-026-merge-train` (off `origin/main`).

## Conflict resolution policy (learned)

- **`docs/agent-backlog-state.md`** conflicts on every merge after 019. The later branch's version is a **cumulative superset** (verified: stage-3 always contains all stage-2 iteration sections plus its own). Resolve with `git checkout --theirs docs/agent-backlog-state.md`, then **verify** `git show :3:… | grep -c '^## Iteration'` > `git show :2:…`. Never resolve a source file this way.
- **`src/lib/tts-tracking.ts`** (022/024/025/026) auto-merges as a clean **union** of added functions — verify by `grep -nE '^export ' ` that every branch's exports survive (`findWordIndexAtTime`, `buildSentenceFallbackTimings`, `resolveCharRange`, `isPlaybackComplete`, …).
- **`src/hooks/useTtsWordHighlight.ts`** (022 extraction + 026 guard) is resolved by mergiraf; **read both branch diffs** (`git diff 022-karaoke-ui -- <file>` and `git diff 026-audio-duration -- <file>`) to confirm the merged file is the union. Collapse any duplicate `import … from '../lib/tts-tracking'` lines.

## Startup inventory every iteration

```bash
pwd
git status --short --untracked-files=all
git branch --show-current
git rev-parse --show-toplevel
git log --oneline -8
git worktree list
```

Load: `CLAUDE.md`, `docs/agent-backlog-state.md`, this skill, `package.json`, `Cargo.toml`, relevant branch diffs, current conflict state.

## Backlog priority ladder

### P0 — dirty state preservation

- Export patch + status snapshot to `/tmp/lectrice-main-*`.
- Classify dirty files; do NOT restore unless patch-backed AND proven safe.
- Do integration in a separate worktree so dirty main stays intact.

### P1 — branch verification

- For each branch: `git merge-base <b> origin/main`, `git log --oneline origin/main..<b>`, `git diff --stat origin/main..<b>`. Confirm no secrets/generated junk.

### P2 — local integration merge train

- From `origin/main`, merge oldest-first 019→026. After each merge: inspect conflicts, resolve per policy above, verify, commit. Do not push.

### P3 — integrated checks (mirror `.github/workflows/ci.yml`)

Frontend (needs `export PATH="$HOME/.local/share/pnpm:$PATH"` + `pnpm install`):

```bash
pnpm typecheck            # tsc --noEmit (excludes *.test.ts)
pnpm lint                 # eslint .
pnpm lint:boundaries
pnpm test:run             # vitest run
pnpm test:arch
pnpm test:coverage        # enforces 46/59/88/46 floors
```

Backend (needs nix-shell with: pkg-config openssl alsa-lib gnumake gtk3 webkitgtk_4_1 libayatana-appindicator librsvg speechd; stub `dist/index.html`):

```bash
cargo fmt --check --manifest-path src-tauri/Cargo.toml
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --features test-mocks -- -D warnings
cargo test --manifest-path src-tauri/Cargo.toml --features test-mocks -j 1
```

If a check cannot run, record the exact command, failure, missing dep, and next action.

### P4 — Codex adversarial review

Codex CLI is `codex` (0.134.0). Run **non-interactively, redirect stdin** to avoid the stdin-hang:

```bash
codex exec --sandbox read-only "$PROMPT" < /dev/null > /tmp/lectrice-mt-codex.log 2>&1
```

Review the merge-resolution diff and the final `origin/main..HEAD` diff. No unresolved BLOCKER/MAJOR may stand for a "ready" claim.

### P5 — GUI validation pack

Prepare a checklist for Pedro (cannot be proven in sandbox): launch, open PDF, restart-reopen (020), normal playback, timestamp word selection (021/022), fallback timing no early page-skip (024/026), page-straddle highlight (025), reduced-motion disables auto-scroll (023). Capture screenshots/logs + app version/branch. Never claim pass without Pedro running it.

### P6 — 018-render-perf preservation + decision

- 3 uncommitted files in `../tauri-pdf-reader-018-render-perf` (`src-tauri/src/lib.rs` +123/-7, `src-tauri/src/commands/settings.rs`, `src/domain/rendering/types.ts`). GPU compositing + niri-managed frame + AT-SPI menu→noctalia bar. GUI-verified live. Patch at `/tmp/lectrice-018-render-perf-*.patch`. Options: commit on its own branch / split / hold as patch. Do not commit or push without approval.

### P7 — old branches 016/017

- `016-cache-coverage-tests` (`c1a5b78`), `017-domain-coverage-tests` (`b385264`) — older base. Inspect, compare vs 019→026, recommend rebase-or-drop. Do not drop without approval.

### P8 — next backlog (only after train is clean)

- Audio-finished detection (poll `sink.empty()` → emit `ai-tts:finished` → event-driven completion; GUI-gated; rodio not unit-testable).
- P2: pdf.js 5.x, render cancellation, virtualization. P3: Kokoro offline voice, accessibility batch.

## State update (end of every iteration)

Update `docs/agent-backlog-state.md` with: date/time, active worktree+branch, preserved patch paths, branches merged/pending, conflicts + resolutions, checks run, Codex path/verdict, GUI-gated items, 018 status, 016/017 status, next exact action.

## Done criteria

Current state preserved, integration advanced or exact blocker documented, checks run as far as possible, Codex run, state updated, git status summarized.
