# User-journey evidence matrix

Last reconciled: 31/08/2026, issue #196 working tree (delivery/review still pending; do not project these additions onto `main`).

`PROVEN` means a packaged Tauri actor reaches the public control and a separate
oracle checks the outcome. `PARTIAL` means deterministic unit/component evidence
exists but no dedicated packaged journey. `BLOCKED` is never green.

| Journey                  | State                                       | Packaged actor and oracle                                                                                                                                                                                                               |
| ------------------------ | ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| First-reader composition | PROVEN at PR head; exact-`A` rerun required | `pnpm test:e2e:north-star`: fresh empty profile → public Open → no-key setup → fixture narration → acknowledged page/highlight → normal close/process end → new process → public Resume same book/page → persisted highlight            |
| File open                | PROVEN                                      | `run-open-journey.sh`: toolbar Open → title/page render; missing file/error is surfaced                                                                                                                                                 |
| Reauthorization          | PROVEN                                      | `run-reauth-journey.sh`: seed/good/cancel/wrong/repeat/retry; opened bytes remain row-hash-bound                                                                                                                                        |
| Home/resume              | PROVEN                                      | `e2e-home.sh`: public resume/play controls, progress and route state                                                                                                                                                                    |
| Reader navigation/zoom   | PROVEN on #196 worktree; delivery pending   | `run-reader-journey.sh` + `e2e-library-completeness.sh`: input/Next/scoped page; physical Ctrl+wheel and 300%; one exact label; ready canvas/text ratios; ≤8192 backing; pointer anchor retained; no preview left behind                |
| Session persistence      | PROVEN                                      | `run-session-journey.sh`: create/restart/delete; row-wins page 3 after restart                                                                                                                                                          |
| Fast close               | PROVEN                                      | `run-close-journey.sh`: real window disappearance <500 ms; DL-1 highlight and DL-2 page survive                                                                                                                                         |
| Highlight                | PROVEN                                      | `run-highlight-journey.sh` plus close lane: public create, backend row, restart persistence                                                                                                                                             |
| Native play/TTS wire     | PROVEN (fixture + local Magpie)             | `native-play.e2e.mjs` covers fixture marks; `e2e-magpie.sh` proves public Performance → Delivery/Continuous → Play, six bounded Vulkan calls, exact source highlight, one natural page advance, and Stop without a false engine failure |
| Narration cockpit        | PROVEN on #196 worktree; delivery pending   | `e2e-narration-cockpit.sh`: four tabs → persisted delivery choices → Play/Pause → physical excerpt replacement → Stop → exact paragraph action → Stop → manual page → immediate Play; real Magpie actor selects Continuous in Delivery  |
| Paragraph margin action  | PROVEN on #196 worktree; delivery pending   | `paragraph-overlay.e2e.mjs` through generic native runner: fit-page targets do not overlap; 100%/300% painted tick/chip x/y geometry, paper contrast contract, ≥44px target, keyboard focus, ≤8192 backing                              |
| Cover                    | PROVEN                                      | `run-cover-journey.sh`: distinct real rasters, fallback, cache-only relaunch, corrupt-cache control, card open                                                                                                                          |
| Contrast/theme           | PROVEN                                      | packaged contrast capture computes light/dark ratios; CSS token/unit contracts cover system mode                                                                                                                                        |
| Delete/cache cleanup     | PROVEN                                      | `run-delete-journey.sh`: revealed public delete, confirmation invocation, DOM+IPC absence, audio/cover cleanup                                                                                                                          |
| Real-book corpus         | PROVEN for runner; final-SHA rerun pending  | `run-corpus-journey.sh`: five external PDFs, page 1/2, card/restart/delete, cover ties/cleanup, corrupt PDF + EPUB controls                                                                                                             |
| Accessibility            | PROVEN on release-critical surfaces         | packaged contrast; exact card names/no duplicate cover announcement; keyboard open and public selectors                                                                                                                                 |
| Error/refusal            | PROVEN                                      | corrupt PDF, unsupported EPUB, missing path, wrong reauthorization file, corrupt cover, random-id cache controls                                                                                                                        |
| Settings                 | PARTIAL                                     | component/store tests cover persisted values; no dedicated packaged settings restart journey                                                                                                                                            |
| Search/filter            | PARTIAL                                     | deterministic library UI tests; no dedicated packaged search journey                                                                                                                                                                    |

## Release interpretation

Settings and search have no known release-blocking defect, but release notes must
not describe them as packaged-E2E-proven. The final release checklist still
requires one clean merged SHA to carry corpus, CodeQL, Sonar, and
adversarial-audit evidence together; the `v0.2.0-rc.0` dry run and the macOS
measurement are stamped at `3d68d0e`.

Every row above is **Linux/X11/WebKitGTK** scoped. On macOS the app builds and
launches but no journey is drivable — no AX windows, no file-association or
open-event path, no macOS WebDriver for `tauri-driver` to proxy — so none of these rows may be read as a
macOS claim (`docs/KNOWN_LIMITATIONS.md`).
