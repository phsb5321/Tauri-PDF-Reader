# Gate contract

## Separation of duties

- **Actor:** sees screenshots and accessibility/DOM state; clicks, types,
  scrolls, uses keyboard shortcuts, resizes, closes, and relaunches.
- **Observer:** prepares a hermetic fixture/profile and records assertions,
  console/IPC/process output, timeouts, and resources.
- **Verdict:** a deterministic replay command and explicit assertions. Never an
  LLM summary, screenshot alone, or hidden store mutation.

The actor must not call `window.__E2E__`, read Zustand/SQLite, invoke Tauri
commands directly, or change fixture state after the journey begins. Read-only
observer instrumentation may inspect internals when a public assertion alone
cannot identify a failure, but it cannot replace the public assertion.

## Required tiers

1. **PR-fast:** targeted Vitest plus seeded `fast-check` command sequences over
   the production state transitions and mockIPC boundary.
2. **Feature completion:** a built Tauri binary driven through WebdriverIO and
   `tauri-driver`/WebKitWebDriver. A missing native runner blocks completion.
3. **Nightly fuzz:** larger seed budget, malformed documents, delayed/failed/
   cancelled IPC, rapid valid actions, and retained minimized regressions.
4. **Nightly soak:** repeated open/read/navigate/TTS/relaunch cycles with crash,
   hang, RSS, CPU, file-descriptor, thread, and event-rate observations.

## Action grammar

Prefer domain commands with preconditions over random coordinate clicks:

- launch, close, relaunch;
- open/resume a document;
- next, previous, jump, and boundary navigation;
- start, pause, resume, stop, seek, speed, voice, and auto-page;
- search, select, highlight, annotate, delete;
- resize, focus, background, foreground;
- corrupt/missing input and injected IPC latency/error/cancellation.

Weight common journeys heavily while retaining boundary and fault actions.
Persist every failing seed and minimized trace as a regression.

## Anomaly oracles

Fail on crash/panic/non-zero exit, unhandled frontend rejection, unexpected IPC
error, watchdog timeout, inaccessible required control, incorrect state after
restart, event/listener growth, or a resource trend outside its reviewed
baseline. Establish resource thresholds from repeated baseline samples; do not
invent a one-off absolute number.

## Evidence record

Retain:

- commit and packaged binary identity;
- OS, WebKitGTK, WebDriver, and fixture/profile identity;
- seed, complete action trace, and deterministic replay command;
- assertion results and failure timestamps;
- accessibility/DOM snapshot, screenshots, and video when available;
- app stdout/stderr, console and IPC errors, resource timeline, and exit code.

Replay failures at least twice to classify reproducibility. Never discard the
first occurrence because subsequent replay passed.
