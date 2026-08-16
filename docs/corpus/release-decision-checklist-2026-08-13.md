# Release decision checklist — v0.2.0

Last reconciled: 16/08/2026, main `01d9952`.

## Decision rule

This page states the **criteria**, not a verdict about itself. Separate the two
things a "receipt" means here:

- **The checks run BEFORE the tag.** Corpus, CI, Sonar, CodeQL and the
  different-family audit all execute against the merged candidate commit, and
  every one must be green for that exact commit before it may be tagged. No
  commit is ever tagged ahead of its evidence.
- **The written row lands AFTER the tag.** A commit cannot contain a table row
  citing runs against itself, so the log entry below is committed afterwards.
  What lags is the bookkeeping, never the verification.

**Cut `v0.2.0` only when every box under "Required at the tagged SHA" is green
for one clean commit, and tag that exact commit.** Any later merge starts the
sequence over: SHA-specific corpus, CI, Sonar, CodeQL and audit evidence do not
transfer across heads.

The RC dry run and the macOS measurement are the two exceptions, SHA-stamped at
`3d68d0e` and not re-run per head: the RC proved the pipeline and the published
artifacts, and the macOS entry records a blocked journey rather than a passing
one. Nothing in the shipped tree's version fields has changed since.

## Merged product evidence

| Item | Merged evidence | State |
| --- | --- | --- |
| Open/reauthorization identity | #122 → `0785afa`; six-phase packaged lane | PASS on Linux; macOS journey BLOCKED (see below) |
| Real first-page covers | #126 → `8ce4836`; #129 → `bda428b`; packaged warm/corrupt-cache and accessibility proof | PASS |
| Contrast and dark theme | #123 → `ecefd01`; #127/#128 → `8bd7ace`/`f52da4b`; packaged contrast + authenticated Sonar | PASS |
| Fast-close DL-1/DL-2 | #125 → `03aca59`; 387/401 ms closes, highlight and page 3 survive restart | PASS |
| Session oracle | #121 → `8848fc3`; create/restart/delete row-wins proof | PASS |
| Packaged-gate trust anchor | #119 → `e46c4ca`; parsed contract and machine-readable prerequisite receipt | PASS for bootstrap contract |
| Real-book runner | #130 → `4f74f4b`; five-book run green at `3747f5d`, `9b13a1f`, `14b43da` | Merged; re-run per candidate commit |

## Required at the tagged SHA

- [ ] Clean corpus run at the candidate commit: `source.json` matches, 23/23 controls,
      five PDFs pass open/card-open/verify, five distinct cover ties,
      corrupt/EPUB controls pass, `failures.tsv` empty, temp profile and `dist/`
      absent after exit.
- [ ] Sonar run at the candidate commit succeeds; authenticated quality gate is `OK`
      with no failing conditions.
- [ ] CodeQL run at the candidate commit succeeds with zero open code-scanning alerts.
- [x] `v0.2.0-rc.0` release-pipeline dry run succeeded at `3d68d0e` (run
      `31911698292`) and published `Lectrice_0.2.0_amd64.AppImage` +
      `Lectrice_0.2.0_amd64.deb` as a prerelease. Both assets were verified on
      the platform they target, a clean Ubuntu 24.04 container: the deb
      installs (`Version: 0.2.0`) and its binary maps a window owned by the app
      process (`WM_CLASS "tauri-pdf-reader"`, 1200x800), and the AppImage does
      the same under `APPIMAGE_EXTRACT_AND_RUN`. The RC prerelease is retained
      as the dry-run receipt. Verbatim receipts:
      `docs/corpus/rc-evidence-2026-08-15.md`.
- [x] macOS scoped truthfully rather than left pending: the app **builds and
      launches** on macOS 26.6.1/arm64 at `3d68d0e` (one instance, bundle
      `0.2.0`, 1176x784 Quartz window), and the interactive open/render/restart
      journey is **BLOCKED** — no AX windows, no file-association or open-event
      path, no macOS WebDriver for `tauri-driver` to proxy. macOS is not a shipped artifact and no
      release note claims it, so this blocks the macOS *claim*, not the Linux
      release. Reasons and reversal conditions: `docs/KNOWN_LIMITATIONS.md`;
      verbatim measurements: `docs/corpus/rc-evidence-2026-08-15.md`.
- [ ] A different-family adversarial audit reviews all evidence above and
      returns `CUTTABLE` for that same commit.

Those boxes are unchecked here by construction: they are verified per candidate
commit and logged below, never pre-declared.

## Remaining infrastructure/documentation evidence

- [x] Host runner cleanup rotation fixed 15/08/2026: scoped manual validation
      returned rc 0, stderr 0, rotated 7747 → 500 lines, no temp residue.
      Reversal backup: `runner-cleanup-hook.sh.bak-20260815`.
- [x] `docs/JOURNEY_EVIDENCE.md` records open, home, reader, session,
      close, highlight, native-play, cover, settings, search, delete, theme,
      accessibility, and error as PROVEN/PARTIAL with their oracle.

## Platform scope of the release

`v0.2.0` ships **Linux AppImage + deb only**. Every release-blocking box above
therefore reads against the Linux artifacts and the Linux packaged lanes. A
macOS box would gate a platform the release does not ship; the measured macOS
state is recorded in `docs/KNOWN_LIMITATIONS.md` instead, including what would
have to change for a macOS journey to become mechanizable.

## Authorization state

Pedro authorized the release actions on 15/08/2026 (17:15 BRT): the
`v0.2.0-rc.0` dry run, the macOS proof, and the final `v0.2.0` tag/release may
proceed without a further per-step ask. Authorization does not lower any
evidence bar — each box above still needs its own exact-SHA receipt, and a
missing runner, offline Mac, or absent artifact stays BLOCKED rather than
becoming a green box.

Risk acceptance for a remaining limitation is still Pedro's alone.

## Verification log

Every candidate commit that was measured, passed or not. A row is a record of
what was run, not a claim that the commit qualified — the `Result` column says
which. The tagged commit's checks all pass before it is tagged; only its row is
written afterwards, for the reason given under "Decision rule".

| Commit | Corpus | Sonar | CodeQL | CI | Audit | Result |
| --- | --- | --- | --- | --- | --- | --- |
| `3747f5d` | `…-final-main-3747f5d.log` ✓ | `31876592457` ✓ | `31876592453` ✓ | — | NOT CUTTABLE | superseded by later merges |
| `9b13a1f` | `…-final-main-9b13a1f.log` ✓ | `31880371934` ✓ | `31880371936` ✓ | — | NOT CUTTABLE | superseded by later merges |
| `3da0320` | `…-FINAL-3da0320.log` ✓ | `31928286389` ✓ | `31928286434` ✓ | `31928286378` **cancelled** | NOT CUTTABLE (red CI) | rejected — cache ate the 10m wall (#138) |
| `8d951e5` | `…-FINAL-8d951e5.log` ✓ | `31934817422` ✓ | `31934817376` ✓ | `31934817394` **failure** | not audited | rejected — Contract Tests failed inside the cache step; Backend Checks cancelled with no steps recorded (#139) |
| `01d9952` | `…-FINAL-01d9952.log` ✓ | `31941343176` ✓ | `31941343177` ✓ | `31941343164` ✓ | NOT CUTTABLE (docs) | rejected — tree claimed its own tag/verdict, fixed by #140 |

Corpus logs live under `/tmp` on the machine that ran them; the names above are
abbreviated `lectrice-corpus-*`. CodeQL alert #4 is fixed and the repository
carries zero open code-scanning alerts. The `v0.2.0-rc.0` dry run ran at
`3d68d0e`; its receipts and the macOS measurement are in
`docs/corpus/rc-evidence-2026-08-15.md`.

No row is a qualifying one yet: each was rejected for the reason in its last
column. The commit that lands this table is unmeasured *at the moment it is
written*; it must pass the same checks, green, before anyone tags it — its row
is then added on top.

The version fields and the changelog entry read `0.2.0` on every candidate,
because the artifacts must identify as 0.2.0 for the RC and the release alike.
That is a statement about the version this tree builds, not a claim that this
particular commit is the tagged one.
