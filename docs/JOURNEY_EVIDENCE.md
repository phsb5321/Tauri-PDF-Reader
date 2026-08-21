# User-journey evidence matrix

Last reconciled: 20/08/2026, Spec 079 candidate preparation on baseline main `a8768a2f273bb99bc5343a83e5b07cf92cfbba8c`.

`PROVEN` means a packaged Tauri actor reaches the public control and a separate
oracle checks the outcome. `PARTIAL` means deterministic unit/component evidence
exists but no dedicated packaged journey. `BLOCKED` is never green.

| Journey                  | State                                       | Packaged actor and oracle                                                                                                                                                                                                    |
| ------------------------ | ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| First-reader composition | PROVEN at PR head; exact-`A` rerun required | `pnpm test:e2e:north-star`: fresh empty profile → public Open → no-key setup → fixture narration → acknowledged page/highlight → normal close/process end → new process → public Resume same book/page → persisted highlight |
| File open                | PROVEN                                      | `run-open-journey.sh`: toolbar Open → title/page render; missing file/error is surfaced                                                                                                                                      |
| Reauthorization          | PROVEN                                      | `run-reauth-journey.sh`: seed/good/cancel/wrong/repeat/retry; opened bytes remain row-hash-bound                                                                                                                             |
| Home/resume              | PROVEN                                      | `e2e-home.sh`: public resume/play controls, progress and route state                                                                                                                                                         |
| Reader navigation        | PROVEN                                      | `run-reader-journey.sh`: current-page input, Next, scoped page render                                                                                                                                                        |
| Session persistence      | PROVEN                                      | `run-session-journey.sh`: create/restart/delete; row-wins page 3 after restart                                                                                                                                               |
| Fast close               | PROVEN                                      | `run-close-journey.sh`: real window disappearance <500 ms; DL-1 highlight and DL-2 page survive                                                                                                                              |
| Highlight                | PROVEN                                      | `run-highlight-journey.sh` plus close lane: public create, backend row, restart persistence                                                                                                                                  |
| Native play/TTS wire     | PROVEN (fixture)                            | `native-play.e2e.mjs`: real play control → Rust fixture command → marks/karaoke advance; live ElevenLabs remains external                                                                                                    |
| Cover                    | PROVEN                                      | `run-cover-journey.sh`: distinct real rasters, fallback, cache-only relaunch, corrupt-cache control, card open                                                                                                               |
| Contrast/theme           | PROVEN                                      | packaged contrast capture computes light/dark ratios; CSS token/unit contracts cover system mode                                                                                                                             |
| Delete/cache cleanup     | PROVEN                                      | `run-delete-journey.sh`: revealed public delete, confirmation invocation, DOM+IPC absence, audio/cover cleanup                                                                                                               |
| Real-book corpus         | PROVEN for runner; final-SHA rerun pending  | `run-corpus-journey.sh`: five external PDFs, page 1/2, card/restart/delete, cover ties/cleanup, corrupt PDF + EPUB controls                                                                                                  |
| Accessibility            | PROVEN on release-critical surfaces         | packaged contrast; exact card names/no duplicate cover announcement; keyboard open and public selectors                                                                                                                      |
| Error/refusal            | PROVEN                                      | corrupt PDF, unsupported EPUB, missing path, wrong reauthorization file, corrupt cover, random-id cache controls                                                                                                             |
| Settings                 | PARTIAL                                     | component/store tests cover persisted values; no dedicated packaged settings restart journey                                                                                                                                 |
| Search/filter            | PARTIAL                                     | deterministic library UI tests; no dedicated packaged search journey                                                                                                                                                         |

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
