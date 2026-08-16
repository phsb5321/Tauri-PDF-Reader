# Release decision checklist — v0.2.0

Last reconciled: 15/08/2026 23:25 BRT, main `8c31cfc`.

## Decision

**NOT CUTTABLE.** Cut only when every required item is green at one clean
`FINAL_SHA`. Any merge invalidates SHA-specific corpus, CodeQL, Sonar, and
adversarial-audit evidence. The RC dry run and the macOS measurement are
SHA-stamped at `3d68d0e` and are not re-run per head: the RC proved the
pipeline and the artifacts, and the macOS entry records a blocked journey
rather than a passing one.

## Merged product evidence

| Item | Merged evidence | State |
| --- | --- | --- |
| Open/reauthorization identity | #122 → `0785afa`; six-phase packaged lane | PASS on Linux; macOS journey BLOCKED (see below) |
| Real first-page covers | #126 → `8ce4836`; #129 → `bda428b`; packaged warm/corrupt-cache and accessibility proof | PASS |
| Contrast and dark theme | #123 → `ecefd01`; #127/#128 → `8bd7ace`/`f52da4b`; packaged contrast + authenticated Sonar | PASS |
| Fast-close DL-1/DL-2 | #125 → `03aca59`; 387/401 ms closes, highlight and page 3 survive restart | PASS |
| Session oracle | #121 → `8848fc3`; create/restart/delete row-wins proof | PASS |
| Packaged-gate trust anchor | #119 → `e46c4ca`; parsed contract and machine-readable prerequisite receipt | PASS for bootstrap contract |
| Real-book runner | #130 → `4f74f4b`; five-book run green on every head since | Merged; re-run at `FINAL_SHA` |

## Required at `FINAL_SHA`

- [ ] Clean corpus run at `FINAL_SHA`: `source.json` matches, 23/23 controls,
      five PDFs pass open/card-open/verify, five distinct cover ties,
      corrupt/EPUB controls pass, `failures.tsv` empty, temp profile and `dist/`
      absent after exit.
- [ ] Sonar run at `FINAL_SHA` succeeds; authenticated quality gate is `OK`
      with no failing conditions.
- [ ] CodeQL run at `FINAL_SHA` succeeds with zero open code-scanning alerts.
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
      journey is **BLOCKED** — no AX windows, no file association or CLI open
      path, no macOS `tauri-driver`. macOS is not a shipped artifact and no
      release note claims it, so this blocks the macOS *claim*, not the Linux
      release. Reasons and reversal conditions: `docs/KNOWN_LIMITATIONS.md`;
      verbatim measurements: `docs/corpus/rc-evidence-2026-08-15.md`.
- [ ] A different-family adversarial audit reviews all evidence above and
      returns `CUTTABLE` for that same SHA.

The three unchecked boxes above have been satisfied on earlier heads — at `3747f5d`
(corpus `/tmp/lectrice-corpus-final-main-3747f5d.log`, Sonar `31876592457`,
CodeQL `31876592453`) and at `9b13a1f` (corpus
`/tmp/lectrice-corpus-final-main-9b13a1f.log`, Sonar `31880371934`, CodeQL
`31880371936`), with CodeQL alert #4 fixed. That history is why the release is
expected to pass; it is **not** evidence for the tag, because this slice moves
the head. The boxes stay unchecked until they are re-run at `FINAL_SHA`.

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

## Current exact-SHA history

Clean exact-SHA corpus, Sonar, and CodeQL evidence has been green on every head
since `3747f5d`, and CodeQL alert #4 is fixed. The `v0.2.0-rc.0` dry run ran at
`3d68d0e` and its receipts, together with the macOS measurement, are in
`docs/corpus/rc-evidence-2026-08-15.md`.

What remains before the tag: re-run the three exact-SHA boxes at `FINAL_SHA`,
then a different-family adversarial audit on that same SHA. Until both land the
verdict remains `NOT CUTTABLE`.
