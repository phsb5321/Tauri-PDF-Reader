# Release decision checklist — v0.2.0

Last reconciled: 15/08/2026 07:07 BRT, main `3747f5d`.

## Decision

**NOT CUTTABLE.** Cut only when every required item is green at one clean
`FINAL_SHA`. Any merge invalidates SHA-specific corpus, CodeQL, Sonar, macOS,
and adversarial-audit evidence.

## Merged product evidence

| Item | Merged evidence | State |
| --- | --- | --- |
| Open/reauthorization identity | #122 → `0785afa`; six-phase packaged lane | Merged; final Mac proof pending |
| Real first-page covers | #126 → `8ce4836`; #129 → `bda428b`; packaged warm/corrupt-cache and accessibility proof | PASS |
| Contrast and dark theme | #123 → `ecefd01`; #127/#128 → `8bd7ace`/`f52da4b`; packaged contrast + authenticated Sonar | PASS |
| Fast-close DL-1/DL-2 | #125 → `03aca59`; 387/401 ms closes, highlight and page 3 survive restart | PASS |
| Session oracle | #121 → `8848fc3`; create/restart/delete row-wins proof | PASS |
| Packaged-gate trust anchor | #119 → `e46c4ca`; parsed contract and machine-readable prerequisite receipt | PASS for bootstrap contract |
| Real-book runner | #130 → `4f74f4b`; five-book pre-merge run green | Merged; clean final-SHA rerun pending |

## Required at `FINAL_SHA`

- [x] Clean exact-SHA corpus at `3747f5d`: `source.json` matches, 23/23
      controls, five PDFs pass open/card-open/verify, five distinct cover ties,
      corrupt/EPUB controls pass, `failures.tsv` empty, temp profile and `dist/`
      absent after exit (`/tmp/lectrice-corpus-final-main-3747f5d.log`).
- [x] Exact-SHA Sonar run `31876592457` succeeded; authenticated quality gate
      is `OK` with no failing conditions.
- [x] Exact-SHA CodeQL run `31876592453` succeeded; high alert #4 is fixed and
      the repository has zero open code-scanning alerts.
- [ ] Exact-SHA macOS build/install/open/render/restart proof records one app
      instance, executable path/PID/SHA, and a real private PDF rendered.
- [ ] `v0.2.0-rc.0` release-pipeline dry run succeeds and produces AppImage +
      deb assets; temporary RC artifacts/tag are cleaned up per the release
      procedure.
- [ ] A different-family adversarial audit reviews all evidence above and
      returns `CUTTABLE` for that same SHA.

## Remaining infrastructure/documentation evidence

- [x] Host runner cleanup rotation fixed 15/08/2026: scoped manual validation
      returned rc 0, stderr 0, rotated 7747 → 500 lines, no temp residue.
      Reversal backup: `runner-cleanup-hook.sh.bak-20260815`.
- [x] `docs/JOURNEY_EVIDENCE.md` records open, home, reader, session,
      close, highlight, native-play, cover, settings, search, delete, theme,
      accessibility, and error as PROVEN/PARTIAL with their oracle.

## Human gates

The following are intentionally not autonomous:

- macOS hardware/session action and visual confirmation;
- creating/deleting an RC tag or GitHub release assets;
- the final real `v0.2.0` tag/release;
- any risk acceptance for a remaining limitation.

No tag or release is authorized by this checklist.

## Current exact-SHA history

At `3747f5d`, clean exact-SHA corpus, Sonar, and CodeQL evidence are green, and
CodeQL alert #4 is fixed. The remaining sequence is human-gated RC dry run and
exact-SHA macOS proof, followed by a final different-family audit on that same
post-gate SHA. Until then the verdict remains `NOT CUTTABLE`.
