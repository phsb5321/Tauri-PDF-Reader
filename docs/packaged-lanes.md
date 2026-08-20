# Packaged lanes — catalogue, user-risk mapping, honest gaps

> Part of the packaged user gate (`.github/workflows/packaged-user-gate.yml`,
> PR #119). Each lane is a packaged-app journey driven through
> tauri-driver + WebKitWebDriver under a hermetic profile, X11 pin and Xvfb.
> "Lane covers" means the packaged app is operated through public controls and
> the listed risk is asserted with a deterministic oracle — never an LLM
> verdict. "Honest gap" is a documented non-coverage; a gap is NEVER silently
> skipped (missing tooling/selector = BLOCKED red).

## The eight deterministic lanes (fixtures — PR-fast + nightly matrix)

| Lane          | Runner                               | User risk it gates                                                                                    | Key assertions                                                                                                                                                                                                                | Honest gaps (non-coverage)                                                                                       |
| ------------- | ------------------------------------ | ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| critical-loop | `e2e/run-critical-loop.sh`           | First open path dead; silent failed opens; karaoke not advancing; menu actions dead; rem text pinned  | Toolbar Open leaves the library; fixture renders (real pdf.js text); real rAF karaoke advances the highlight index; menu-action dispatches; corrupt open shows the error banner; root font-size scales rem text (24px → 36px) | Native file dialog (seam injected); no live ElevenLabs audio; no TTS key entry flow; fixture PDF only            |
| native-play   | `scripts/e2e-native.sh`              | TTS playback path broken (with the fixture backend, no network)                                       | TTS store reaches "playing" via the e2e-tts-fixture backend                                                                                                                                                                   | Fixture timings, not a real audio device; no live ElevenLabs key                                                 |
| home          | `scripts/e2e-home.sh` (no-key + key) | Fresh install shows no TTS-setup signal; resume-and-play degrades dishonestly; Also-in-progress wrong | No-key: setup signal + Configure visible, no "Also in progress", honest degradation; key: signal gone, resume-and-play drives the store to playing                                                                            | Session-only key path; first-run UI exercised via seeded profile, not a real empty install                       |
| open          | `e2e/run-open-journey.sh`            | Toolbar Open strands the user on the library; corrupt opens are silent                                | Good fixture opens the reader surface; corrupt fixture surfaces a visible error banner                                                                                                                                        | Dialog seam injected; one fixture path per phase                                                                 |
| session       | `e2e/run-session-journey.sh`         | Resume opens the wrong document or the wrong page                                                     | Restore lands on the right document AND the row's page (the DL-2 second-half regression is pinned here)                                                                                                                       | Fixture only; no real multi-book library                                                                         |
| reader        | `e2e/run-reader-journey.sh`          | Reading position lost across restart; navigation and page input broken                                | Position survives a genuine restart; nav moves the rendered page; the page input works                                                                                                                                        | Fixture only; zoom/karaoke beyond the asserted set                                                               |
| highlight     | `e2e/run-highlight-journey.sh`       | User highlights silently lost on close/relaunch (DL-1 class)                                          | Created highlight survives a genuine window close + relaunch                                                                                                                                                                  | Single fixture + single highlight shape                                                                          |
| close         | `e2e/run-close-journey.sh`           | Fast-close data loss: page position (DL-2) and highlight row                                          | Genuine WM_DELETE_WINDOW inside the 500 ms debounce; dl1 + dl2 verify phases; `actionToWindowCloseMs < 500` asserted                                                                                                          | xdotool windowclose is the WM's close message — not minimize/restore, multi-window or session-manager lifecycles |

**PR-fast = critical-loop only** (cheapest meaningful packaged lane, runs on
every PR). The other seven run in the nightly/manual full matrix, strictly
serial (single-slot vm103 — the matrix exists in time, never in parallel
jobs). `tools/check-packaged-gate-contract.sh` proves the workflow cannot
silently drop any of the eight.

## The real-corpus tier (post-merge/manual — `real-corpus` job)

**Why:** every fixture lane runs generated 3-page PDFs. The risk that no
fixture exercises is the REAL book: multi-hundred-page PDFs, real fonts,
real page-render cost, real file sizes.

| Risk                                                             | Fixture coverage               | Real-corpus coverage                                                 |
| ---------------------------------------------------------------- | ------------------------------ | -------------------------------------------------------------------- |
| A real book opens and renders (pdf.js parse of a large real PDF) | partial (3-page generated PDF) | **asserted**: `totalPages > 10` (the DE corpus is 300+ pages)        |
| Page navigation on a real book                                   | partial                        | **asserted**: page 1 → 3 via menu actions                            |
| Fast-close position persistence (DL-2) on a real book            | asserted on fixtures           | **asserted**: genuine close < 500 ms, relaunch row + rendered page 3 |
| Resume/restore on a real multi-page book                         | partial                        | **asserted** (verify phase)                                          |

**Copyright boundary (never stores copyrighted PDFs/artifacts):**

- The hook consumes `LECTRICE_REAL_PDF_CORPUS` — a LOCAL directory path on
  the runner (the five-book Data Engineering corpus). Never a URL.
- Per book, the observer stages a TRANSIENT copy inside the hermetic
  profile's applocaldata (the only in-fs-scope read path — no capability
  widening, no build embedding). The profile is deleted by the script's
  trap on success AND failure.
- Outputs are per-book/phase logs (`/tmp/lectrice-corpus/<book>/<phase>.log`)
  and a machine-readable `summary.json` (per-book sha256, per-phase
  result/exit code). The artifact upload carries logs + summary ONLY — no
  PDF bytes, no derived renders, no profile dir, no corpus dir.
- Run locally: `LECTRICE_REAL_PDF_CORPUS=~/Books/DE bash scripts/e2e-real-corpus.sh`.

## Scope rule

PR-fast stays deterministic fixtures. The real-corpus hook is
workflow_dispatch-only (post-merge/manual); it is never wired to
pull_request. Missing corpus, missing driver, missing display → BLOCKED red,
never skip-green.

## Trust architecture — 3-stage reference (root fix, 14/08)

An in-workflow contract can never self-establish trust: the candidate's
pull_request workflow controls its own steps before any checker runs. The
trust boundary is therefore a BASE-OWNED anchor, in three stages:

1. **This bootstrap PR (#119)** — tooling/config only, NO `.github/workflows/**`
   diff: the parser checkers, the canonical EXECUTION fixture
   (`tools/test/fixtures/packaged-user-gate.yml` — the three lane jobs only,
   no contract job), the canonical TRUST-ANCHOR fixture
   (`tools/test/fixtures/packaged-gate-trust-anchor.yml`), the negative
   controls, the flake tooling and the e2e runners. Merges safe: nothing in
   it executes on the self-hosted runner.
2. **Follow-up PR A (Pedro-gated)** — copies the TRUST-ANCHOR fixture into
   `.github/workflows/packaged-gate-trust-anchor.yml` and merges. The anchor
   runs on `pull_request_target` (resolved from BASE — the head cannot
   modify it), with BASE tools: checkout BASE SHA, fetch the candidate
   execution workflow at the HEAD sha via the GitHub API AS DATA (never
   checked out, never executed, no head scripts, HEAD_SHA via env only),
   run the BASE checker + NC against the fetched file. The first
   introduction cannot self-run; after this merge the anchor is live.
3. **Follow-up PR B (Pedro-gated)** — copies the EXECUTION fixture into
   `.github/workflows/packaged-user-gate.yml`. From then on, EVERY PR's
   execution workflow is validated by the base anchor (a required check)
   BEFORE any head-controlled code can reach the self-hosted runner.

The anchor itself is validated by `tools/check-packaged-gate-trust-anchor.mjs`
(trigger set, one job, same-repo guard, base checkout, API-only head fetch,
no event-payload shell interpolation, no head execution, SHA pins, deep
equality) plus review — it is the trust root by construction.

## Bounded one-off recovery actor — `north-star-journey` (20/08, spec 079)

**This lane is NOT part of the deterministic matrix above and holds no matrix
authority.** It is a bounded one-off composed for the 079 alignment recovery:
it proves the first-reader journey end to end at one exact source SHA, and it
is invoked deliberately, never on `pull_request`. The eight deterministic
lanes and the real-corpus tier remain the standing catalogue; nothing here
adds, replaces or reorders them.

```bash
pnpm test:e2e:north-star          # = bash e2e/run-north-star-journey.sh
```

Landed by **PR #160 → `a8768a2`** (`e2e/north-star-journey.e2e.mjs` +
`e2e/run-north-star-journey.sh`).

**Shape.** Three ordered phases on ONE hermetic profile
(`mktemp -d /tmp/lectrice-north-star-profile.XXXXXX`, seeded through the
existing `scripts/e2e-profile.sh`): `no-key-open` → `configured-close` →
`resume-verify`. The actor drives only public reader controls; the
instrumentation observes and never acts. Between phases the runner asserts the
persisted state directly (one opened document, acknowledged page 3, at least
one surviving highlight) and exits non-zero the moment one fails — a later
phase can never paper over an earlier one.

**Fail-closed inputs.** `set -euo pipefail`; the phase name must be one of the
three; `NORTH_STAR_SOURCE_SHA` must be a full 40-hex SHA; and
`git diff --quiet HEAD --` refuses to run against uncommitted build inputs, so
a result can always be tied to an exact committed tree.

**Nested-lock invocation — read this before wrapping it.** The lane serializes
on `/tmp/lectrice-heavy-gate.lock`, the same lock the other heavy gates take.
The documented caller shape is:

```bash
flock /tmp/lectrice-heavy-gate.lock bash e2e/run-north-star-journey.sh
```

That child **inherits the already-held lock fd**. The runner detects this
(it resolves its inherited descriptors against `LOCK_PATH`) and does **not**
re-acquire on fd 9 — a second `flock` on the same file from the same process
tree would deadlock against itself, with the 1200 s timeout as the only exit.
When it is *not* inherited the runner takes the lock itself, so both the bare
and the wrapped invocation are correct and neither double-locks. To check
which path a given invocation took without running the journey:

```bash
NORTH_STAR_LOCK_PROBE=1 bash e2e/run-north-star-journey.sh   # prints inherited=true|false
```

**Scope rule (unchanged).** Missing driver, missing display or a dirty tree is
a BLOCKED red, never a skip-green. Do not wire this lane to `pull_request`,
and do not cite it as authority for what the packaged matrix covers.
