# Release decision checklist — v0.2.0 (tied to merged SHA)

Authoritative date: 13/08/2026 (BRT), 18:02. Branch: `125-corpus-runner`.
Purpose: the exact go/no-go gate for cutting v0.2.0. Every item is tied to a
MERGED SHA plus a runnable user-facing receipt — packet claims and unit-only
evidence do not close release items (#120 evidence policy).

## Decision rule

**CUT v0.2.0 ONLY when ALL items PASS at ONE merged SHA** — the same `FINAL_SHA`
used by the release pipeline dry-run, the adversarial audit, and the macOS
proof. Any item FAILs → hold; record the exact failing evidence.

## A. User-visible blockers (each: merged SHA + packaged receipt)

| #   | Item                   | Close criteria (receipt)                                                                                                            | PASS @ FINAL_SHA |
| --- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| A1  | macOS file open        | #122 merged as `<sha>`; real private PDF opened in the Mac app, page text rendered, no capability widening                          | ☐                |
| A2  | Real first-page covers | covers PR merged as `<sha>`; distinct pixel hashes for two PDFs, fallback negative control, cached relaunch, card opens stored page | ☐                |
| A3  | Low-contrast text      | #123 merged as `<sha>`; computed fg/bg ratios light+dark: normal ≥4.5:1, large ≥3:1 (packaged screenshots)                          | ☐                |
| A4  | Fast-close DL-2        | DL-2 fix merged as `<sha>`; actual window disappears <500 ms; restarted row/page is latest                                          | ☐                |

## B. Test/release blockers

| #   | Item                      | Close criteria                                                                                                                                                              | PASS @ FINAL_SHA |
| --- | ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| B1  | Session oracle            | MERGED `8848fc3` (#121) + lane receipt — **already PASS**                                                                                                                   | ☑                |
| B2  | PR-fast packaged CI       | #119 merged (Pedro-gated workflow) as `<sha>`; serial PR-fast lane green on vm103                                                                                           | ☐                |
| B3  | Real-book corpus          | corpus runner merged as `<sha>`; FULL private run green at FINAL_SHA (23/23 controls + per-book open/card-open/verify + negative controls + cover ties; failures.tsv empty) | ☐                |
| B4  | Dark-mode CSS             | merged as `<sha>`; zero CSS syntax warnings in build; explicit + system dark modes covered                                                                                  | ☐                |
| B5  | Mac stale-build ambiguity | resolved as `<sha>`; exactly one instance, PID/SHA recorded                                                                                                                 | ☐                |
| B6  | Runner failure evidence   | fixed as `<sha>`; machine-readable receipt on prerequisite failure                                                                                                          | ☐                |
| B7  | Runner cleanup hook       | fixed (host infra) as `<sha>`; hook log writable                                                                                                                            | ☐                |
| B8  | Journey coverage explicit | catalogue open/home/reader/session/close/highlight/native-play/cover/settings/search/delete/theme/a11y/error as PROVEN/PARTIAL/BLOCKED with oracle                          | ☐                |

## C. Pipeline & quality (all at FINAL_SHA)

| #   | Item                       | Criteria                                                                                                                                        | PASS |
| --- | -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| C1  | Sonar                      | post-merge scan SUCCESS at FINAL_SHA (was green at `4fe30e3`; re-verify — new code since)                                                       | ☐    |
| C2  | CodeQL                     | green at FINAL_SHA                                                                                                                              | ☐    |
| C3  | Release pipeline dry-run   | `v0.2.0-rc.0` tag at FINAL_SHA → GREEN run + AppImage + deb assets → artifacts deleted → real tag (Pedro-gated)                                 | ☐    |
| C4  | Adversarial release audit  | SHA-specific NOT_CUTTABLE review at FINAL_SHA (old audit packets do not count)                                                                  | ☐    |
| C5  | macOS build/install/visual | exact FINAL_SHA build → `~/Applications/Lectrice.app` installed → window render visually confirmed (unlock) — launch-only evidence insufficient | ☐    |

## D. Pedro gates (not self-mergeable, surface only)

- #119 workflow merge (`.github/**`) — approval + exact checks + rollback.
- v0.2.0 tag + GitHub release (after C3 dry-run green).
- Mac screen unlock for C5 visual proof.
- Any risk-acceptance needed on harness limitations (documented, not silent).

## E. Corpus-specific pre-release verification (this lane, at FINAL_SHA)

1. Rebase `125-corpus-runner` onto FINAL_SHA; bootstrap conflict resolved
   (map §bootstrap); 23/23 controls green.
2. Full private run per `run-order-2026-08-13.md` under the heavy gate;
   failures.tsv EMPTY; cover-hashes.tsv count == 5, all distinct.
3. Every corpus failure (if any) posted to #120 with basename+sha+phase+
   command — never book content.
4. #120 real-book checkbox closes ONLY with the merged runner + this evidence.

## F. Re-verify cadence

- After EVERY merge: re-run the §0 closure truth-check and this checklist's
  affected rows; the checklist is not final until FINAL_SHA is chosen and the
  release slice (tag) is about to be cut.
