# Tasks

- [x] Create the repository-scoped `lectrice-user-gate` skill.
- [x] Document actor, observer, fuzz, anomaly, and evidence boundaries.
- [x] Install pinned `fast-check` as a development dependency.
- [x] Add the seeded stateful navigation command model.
- [x] Add focused and composed package commands. `test:user-gate` composes only
  the actor-compliant native-play lane; `critical-loop` is explicitly excluded
  because it acts through `window.__E2E__` after launch.
- [x] Emit a versioned typed trace for every fuzz run and replay a retained
  seed/action path without an LLM, including a minimized failing trace. Proven
  by the planted failure/replay regression and `FC_SEED=17 FC_NUM_RUNS=2000
  pnpm test:fuzz` (02/08/2026 00:15 BRT).
- [ ] Prove the actor-compliant native-play lane on this host and retain its
  artifacts. The first native-play run after the window-size diagnostic used a
  programmatic DOM click; it is retained as diagnostic evidence only and cannot
  satisfy the public-actor gate. Re-run with WebDriver `playBtn.click()`; a
  pointer-driver failure is BLOCKED, not a reason to restore the DOM click.
- [ ] Current native-play evidence is BLOCKED: on 02/08/2026 00:10 BRT,
  `pnpm test:e2e:native` exited 1 after `browser.setWindowSize(1200, 800)`;
  `.ai-playback-button` remained non-clickable after 15 seconds, before any
  actor activation. Log: `/tmp/lectrice-075-native-play-pointer.log`.

  **Diagnosis 04/08/2026 (`main` @ `9c279f6`, roadmap item 1.2) — root cause
  discriminated, verdict: HARNESS ARTIFACT, not a feature-gate or real
  regression.** Re-run instrumented with `waitForClickable()` diagnostics
  (rect/`elementFromPoint`/computed style) plus a console-log capture bridge
  (`window.__DIAG_LOGS__`, temporary, not committed).
  - Run A (unmodified `playBtn.click()`, pointer path): `waitForClickable()`
    now PASSES within 15s (the original "non-clickable" symptom from
    02/08/2026 did not reproduce — that earlier failure mode is retired).
    But after the pointer click, `__DIAG_LOGS__` captured ZERO logs from
    `handlePlay`/`speakWithHighlight` — no "Requesting TTS with timestamps",
    no double-call guard, nothing. `wordCount()` stayed 0, `playbackState()`
    stayed `"idle"`. The button itself reported `disabled: false`. Full log:
    `/tmp/lectrice-075-native-play-pointer-2026-08-04.log`.
  - Run B (control probe only — `document.querySelector(".ai-playback-button").click()`,
    same build, same binary, only the activation step changed): PASSED in
    1.7s. Full chain fired end to end — `invoke` round-tripped, `wordCount()
    > 0`, karaoke index advanced. Full log:
    `/tmp/lectrice-075-native-play-domclick-control-2026-08-04.log`.
  - **Discriminator:** same button, same build, same binary, only the click
    mechanism differs. wdio's `waitForClickable()` (a browser-side JS
    `elementFromPoint` check) reports the button visible/enabled/unobscured,
    yet the WebDriver Actions-API pointer dispatch that follows never
    triggers React's `onClick`. This rules out feature-gate (no API-key
    empty-state — the button IS `canPlay`, fixture backend responds
    instantly when actually invoked) and real regression (the production
    chain works perfectly once genuinely clicked). It is exactly the
    documented vimeflow#65 class: WebKitGTK software-rendering pointer
    hit-test/dispatch mismatch. Severity for 1.2 downgrades from "headline
    feature dead" to "this local WebDriver harness cannot drive WebKitGTK
    pointer input on this host" — M3.1 (release pipeline) is NOT blocked by
    a real Play-button defect. The gate item stays open per the standing
    rule above (no DOM-click bypass in the committed test); it is a harness
    limitation to fix in the driver/environment, not a product bug to fix in
    `AiPlaybackBar.tsx`.
  - Diagnostic edits to `e2e/native-play.e2e.mjs` used for Run A/B were
    reverted after capture; the file is back to its pre-diagnostic WIP
    state (`playBtn.click()`, no DOM-click bypass, no diag instrumentation).
- [ ] Add one public native journey for every subsequently changed feature.
- [ ] Refactor `critical-loop.e2e.mjs` to public UI/keyboard actor actions with
  observer-only prelaunch fixture setup before re-admitting it to
  `test:user-gate`; until then it is retained only as bridge-driven integration
  diagnostic evidence.
- [ ] Adopt frozen 074 as the next feature-specific native journey: launch with
  a versioned hermetic profile holding the 585-page fixture at page 213; assert
  Library, Continue reading, `Page 213 of 585`, public Resume, reader page 213,
  then normal close/relaunch and the same shelf/reader page. Its persistence
  vertical uses visible Next page and requires page 214 after relaunch.
