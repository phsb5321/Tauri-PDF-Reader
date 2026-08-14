/**
 * Packaged close-journey E2E (tauri-driver + WebdriverIO).
 *
 * The close-and-relaunch oracle for two data-loss findings (DL-1, DL-2):
 * nothing in src-tauri handles on_window_event / CloseRequested, so pending
 * debounced writes are never flushed when the window goes away.
 *
 *   DL-1 — a highlight created just before quitting is lost (the create
 *          used to sit behind a 500 ms debounce; the success toast fired
 *          unconditionally — now the toast is honest and the create flushes
 *          immediately, so the race is the write's IPC vs the teardown).
 *   DL-2 — reading position is lost on close (useAutoSave scheduleSave(500)
 *          on page change; checkUnsavedProgress has zero callers).
 *
 * Four phases, one hermetic profile, fresh app process per phase:
 *   CLOSE_PHASE=dl1-create  resume (Tab+Enter) → drag-select → PUBLIC
 *                           Ctrl+Shift+H → observe the accepted highlight
 *                           marker (optimistic overlay, NOT the toast) →
 *                           CLOSE — must be >=200ms AND <500ms (the create
 *                           IPC is deliberately in flight for
 *                           LECTRICE_E2E_HIGHLIGHT_CREATE_DELAY_MS=250, so a
 *                           fast close proves nothing about the hold).
 *   CLOSE_PHASE=dl1-verify  relaunch → resume → the highlight must STILL be
 *                           there. RED on main.
 *   CLOSE_PHASE=dl2-create  resume (page 2) → PUBLIC ArrowRight → observe
 *                           the Current-page INPUT = 3 → CLOSE IMMEDIATELY
 *                           (inside the 500 ms debounce).
 *   CLOSE_PHASE=dl2-verify  relaunch → resume → the page must be 3 (where
 *                           the user was). RED on main.
 *
 * THE CLOSE IS A GENUINE WINDOW CLOSE, not a process kill: the actor closes
 * the window through the X server (xdotool windowquit — per `man xdotool`,
 * "Close gracefully; sends a request, allowing application close confirmation
 * mechanics" — it sends WM_DELETE_WINDOW, the client message a window manager
 * sends on the close button, which is what reaches the app's CloseRequested).
 * windowclose would be WRONG here: "destroy the window, will not try to kill
 * client" — it tears the window down without any close request, so the app
 * never receives CloseRequested and every DL phase proves nothing (the 14/08
 * lane-6/lane-8 evidence). A SIGKILL
 * would prove nothing about CloseRequested and would pass a broken fix.
 * The close is the FINAL statement of each create phase; nothing runs after
 * it, and the harness tolerates the session death at teardown.
 *
 * The GTK dialog seam (VITE_E2E_OPEN_PATH) is not used here — resume goes
 * through the public Resume button. `window.__E2E_READ__` is read-only
 * observer instrumentation.
 *
 * Run with:  E2E_SPEC=./e2e/close-journey.e2e.mjs  CLOSE_PHASE=dl1-create|dl1-verify|dl2-create|dl2-verify
 * against a binary built `--features e2e-tts-fixture` and a frontend built
 * `VITE_E2E_NATIVE=true` — see e2e/run-close-journey.sh.
 */

/* global browser, $, expect */

import { spawn, execFileSync } from "node:child_process";
import { writeFileSync, readFileSync } from "node:fs";

const PHASE = process.env.CLOSE_PHASE || "dl1-create";

/**
 * Where closeAndObserve() publishes the timings the runner reports. The runner
 * hands down a per-run path; the fallback stays inside the hermetic profile
 * (scripts/e2e-profile.sh mktemp -d) so a standalone spec run still works.
 *
 * There is deliberately NO shared-/tmp default. A predictable path in a
 * world-writable directory is both a symlink-clobber hazard (CodeQL
 * js/insecure-temporary-file) and the collision this lane already guards
 * against elsewhere: it would outlive its run and clash with the concurrent
 * sibling worktrees the pkill anchor exists for — one runner deleting the
 * in-flight evidence of another, or printing its numbers as its own.
 */
const TIMING_DIR = process.env.XDG_DATA_HOME;
const TIMING_PATH =
  process.env.CLOSE_TIMING_PATH ||
  (TIMING_DIR ? `${TIMING_DIR}/close-timing-${PHASE}.json` : null);

/**
 * The debounce the close is racing: 500 ms, the explicit argument at
 * useAutoSave.ts:90 (page progress) and useHighlightPersistence.ts:30
 * (highlights). A close that lands OUTSIDE this window proves nothing — the
 * debounce would have flushed by itself — so exceeding it is a hard failure,
 * never a pass. Note wdio's waitforInterval default is also 500 ms, so a
 * single missed poll inside a timed window is enough to blow the budget.
 */
const DEBOUNCE_MS = 500;

/**
 * The actor closes the window the way a user does: WM_DELETE_WINDOW through
 * the X server (xdotool windowquit — the WM_DELETE_WINDOW close-confirmation
 * message; see the header note on why windowclose is wrong). Runs under the
 * lane's DISPLAY.
 *
 * Deliberately a DETACHED spawn, not an execSync: the close request must
 * reach the window as fast as physically possible after the actor's last
 * action (the data-loss race is a 500 ms debounce vs the app's teardown
 * latency — every ms counts). The spec makes no further commands after it,
 * so the session death is absorbed by teardown.
 */
function closeWindow() {
  spawn("xdotool", ["search", "--name", "Lectrice", "windowquit"], {
    detached: true,
    stdio: "ignore",
  }).unref();
}

/**
 * Close the window as a user does, then OBSERVE the close — and FAIL if it
 * did not happen. Without that assertion a silent xdotool failure (wrong
 * DISPLAY, renamed window) ends the phase green, and the runner's pkill then
 * substitutes a SIGTERM — a process kill, which proves nothing about
 * CloseRequested and would pass a broken fix. The window is confirmed alive
 * BEFORE the close for the same reason: otherwise "gone" latches on the first
 * poll and reports a spurious ~0 ms.
 *
 * `windowClosedAt` is the only sound close instant. A timestamp stamped just
 * before the detached spawn excludes the fork/exec and xdotool's X-tree walk,
 * so it UNDER-states the click→close interval — the wrong direction for an
 * "inside the 500 ms debounce" claim, which needs an upper bound.
 */
/**
 * Prepare the close observer BEFORE the public action. Everything the close
 * measurement needs — the child_process import, the cwd regex, the
 * window/process precondition CAPTURES — happens here, so the action→close
 * interval contains NO setup work: the returned closure's first statement is
 * the WM close itself. (The prior structure ran the import + regex + both
 * precondition probes AFTER tAction, inflating the measured interval by
 * process spawns — the 551-974ms self-inflicted readings.)
 */
function prepareCloseObserver() {
  // execFileSync (argv, no shell) so a repo path containing a quote or a
  // regex metacharacter cannot reshape the pattern.
  const cwdRe = process.cwd().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const appPattern = `^${cwdRe}/src-tauri/target/debug/tauri-pdf-reader`;
  const alive = (file, args) => {
    try {
      execFileSync(file, args, { stdio: "ignore" });
      return true;
    } catch {
      return false;
    }
  };
  const windowAlive = () => alive("xdotool", ["search", "--name", "Lectrice"]);
  // pgrep keeps matching a ZOMBIE until WebDriver reaps it (~50s on this
  // stack — the lane-5 tDeath readings). A zombie cannot execute or write,
  // so it is logically DEAD for this lane's purposes: inspect each matched
  // pid's /proc/<pid>/stat state char and treat Z as dead. Any non-Z match
  // means the app is genuinely still running.
  const appAlive = () => {
    let pids;
    try {
      pids = execFileSync("pgrep", ["-f", appPattern], {
        encoding: "utf8",
      }).trim();
    } catch {
      return false;
    }
    for (const pid of pids.split(/\s+/)) {
      if (!pid) continue;
      try {
        const stat = readFileSync(`/proc/${pid}/stat`, "utf8");
        // /proc/pid/stat: "pid (comm) STATE ..." — the comm may contain
        // spaces/parens, so anchor on the first ) then take the next char.
        const m = stat.match(/^\d+ \(.*\) ([A-Za-z])/);
        if (m && m[1] !== "Z") return true; // genuinely alive
      } catch {
        return false; // pid vanished between pgrep and the stat read
      }
    }
    return false; // every match is a zombie (or gone)
  };

  // Preconditions captured immediately BEFORE the action — the closure
  // asserts them AFTER the close (their truth at capture time is what the
  // measurement relies on).
  const windowSeenBefore = windowAlive();
  const appSeenBefore = appAlive();

  return async function closeAndObserve(tAction) {
    // FIRST statement after tAction: the WM close. Nothing else runs
    // between the action's timestamp and the close request.
    closeWindow();

    let windowClosedAt = null;
    let tDeath = null;
    for (let i = 0; i < 200; i++) {
      if (windowClosedAt === null && windowSeenBefore && !windowAlive()) {
        windowClosedAt = Date.now();
      }
      // Logical death = appAlive() false (a zombie counts as dead).
      if (!appAlive()) {
        tDeath = Date.now();
        // The app can die between this iteration's window probe and its app
        // probe. Without this last look the close would be recorded as
        // "never happened" and reported as a false RED blaming the wrong
        // thing.
        if (windowClosedAt === null && windowSeenBefore && !windowAlive()) {
          windowClosedAt = Date.now();
        }
        break;
      }
      await new Promise((r) => setTimeout(r, 50));
    }

    const timings = {
      phase: PHASE,
      tAction,
      windowSeenBefore,
      appSeenBefore,
      windowClosedAt,
      tDeath,
      // The decisive, sound number: an UPPER bound on action→close-delivered.
      actionToWindowCloseMs: windowClosedAt ? windowClosedAt - tAction : null,
      actionToDeathMs: tDeath ? tDeath - tAction : null,
      windowCloseToDeathMs:
        windowClosedAt && tDeath ? tDeath - windowClosedAt : null,
    };
    const record = JSON.stringify(timings);
    if (!TIMING_PATH) {
      throw new Error(
        "no timing destination: set CLOSE_TIMING_PATH (the runner does) or run under a hermetic profile that exports XDG_DATA_HOME — refusing to fall back to a predictable shared /tmp path",
      );
    }
    writeFileSync(TIMING_PATH, record);

    // The close is the phase's product; an unobserved close is not a close.
    if (!windowSeenBefore) {
      throw new Error(
        `close NOT OBSERVABLE: no window named Lectrice on DISPLAY=${process.env.DISPLAY} before the close — the lane cannot prove a genuine WM_DELETE_WINDOW. ${record}`,
      );
    }
    if (!appSeenBefore) {
      throw new Error(
        `app process NOT MATCHED before the close (pattern ${appPattern}) — the death poll would exit immediately and every interval would be wrong. ${record}`,
      );
    }
    if (windowClosedAt === null) {
      throw new Error(
        `window NEVER CLOSED after xdotool windowquit — the close never reached the app, so this phase proves nothing about CloseRequested. ${record}`,
      );
    }
    // Logical process death must follow the window disappearance within 3s.
    // A zombie counts as dead (it cannot execute/write); a non-zombie that
    // survives past the bound means the app did NOT shut down — RED. (The
    // Gdk "BadDrawable" warning seen in earlier runs is post-close
    // WebKit/Xvfb teardown noise and is only tolerable BECAUSE the process
    // is already a zombie by then; a live survivor is a genuine defect.)
    if (tDeath === null || timings.windowCloseToDeathMs > 3000) {
      throw new Error(
        `app NOT logically dead within 3s of the window disappearing (windowCloseToDeathMs=${timings.windowCloseToDeathMs}ms, tDeath=${tDeath}) — the process outlived the close. ${record}`,
      );
    }
    // THE PREMISE, ASSERTED — not merely measured. Everything this lane concludes
    // rests on the close beating the debounce; if it did not, a later green is
    // vacuous (the debounce flushed on its own) and must not be reported as a
    // pass. This is the fail-open link that the rest of the lane exists to close.
    if (timings.actionToWindowCloseMs >= DEBOUNCE_MS) {
      throw new Error(
        `close TOO SLOW to test the race: ${timings.actionToWindowCloseMs}ms >= the ${DEBOUNCE_MS}ms debounce, so the debounce could have flushed by itself and this phase proves nothing either way. ${record}`,
      );
    }
    // DL-1's premise is the CLOSE HELD THE WINDOW for the deliberately
    // in-flight create IPC (LECTRICE_E2E_HIGHLIGHT_CREATE_DELAY_MS=250): a
    // close that lands before ~200ms killed the write before it could even
    // complete and proves nothing about the hold (the 68ms closes of the
    // pre-delay runs are exactly the false-green the delay exists to
    // eliminate). The 500ms upper bound is the debounce premise above.
    if (PHASE === "dl1-create" && timings.actionToWindowCloseMs < 200) {
      throw new Error(
        `DL-1 close TOO FAST to prove the hold: ${timings.actionToWindowCloseMs}ms < 200ms — the window was not held for the in-flight create IPC (the 250ms delay was still pending), so this phase proves nothing about CloseRequested. ${record}`,
      );
    }
    return timings;
  };
}

describe("Packaged close journey (DL-1 highlight loss, DL-2 position loss)", () => {
  it(`${PHASE}: ${PHASE.includes("dl1") ? "highlight survives an immediate close" : "reading position survives an immediate close"}`, async function () {
    // The close observer polls window+process disappearance for up to 200
    // iterations; under host load each xdotool/pgrep spawn stretches, so the
    // default 120s mocha budget is not enough for a truthful observation.
    // The close still must beat the 500ms debounce — the poll length does
    // not weaken that premise, it only makes the observation reliable.
    this.timeout(300000);
    await browser.waitUntil(
      async () =>
        browser.execute(
          () => !!(window.__E2E_READ__ && window.__E2E_READ__.ready),
        ),
      { timeout: 40000, timeoutMsg: "bootstrap never became ready" },
    );
    await browser.setWindowSize(1200, 800);

    // PRE-RESUME probe (dl2-verify only): the row's page BEFORE any actor
    // action, plus the app's boot logs — pins whether the 3→2 revert happens
    // in the app's boot or in the resume.
    if (PHASE === "dl2-verify") {
      console.log(
        "DIAG dl2-pre-resume:",
        JSON.stringify(
          await browser.execute(async () => ({
            rowPage: await window.__E2E_READ__.ipcDocumentPage(),
            storePage: window.__E2E_READ__.currentPage(),
            logs: window.__E2E_READ__.logs().slice(-15),
          })),
        ),
      );
    }

    // Every phase starts the same: resume the seeded fixture through the
    // PUBLIC keyboard — Tab-cycle until document.activeElement IS the resume
    // button (an observe-only execute), then Enter (a public key action). No
    // injected click/focus: the actor navigates the real focus order.
    const resumeSelector =
      'button[aria-label^="Resume E2E Resume Fixture A, page"]';
    await browser.waitUntil(
      async () =>
        browser.execute(
          (sel) => !!document.querySelector(sel),
          resumeSelector,
        ),
      { timeout: 15000, timeoutMsg: "resume button never appeared" },
    );
    let resumeFocused = false;
    for (let i = 0; i < 40; i++) {
      resumeFocused = await browser.execute(
        (sel) => {
          const el = document.activeElement;
          return !!el && el.matches(sel);
        },
        resumeSelector,
      );
      if (resumeFocused) break;
      await browser.keys(["Tab"]);
    }
    if (!resumeFocused) {
      throw new Error(
        "resume button never reached by the public Tab-cycle (40 tabs) — cannot resume through the keyboard",
      );
    }
    await browser.keys(["Enter"]);
    // The resume lands on the row's ACTUAL page (public oracle: the Current
    // page input, never __E2E_READ__). The expected page comes from the
    // resume button's own accessible name (public), not from the observer.
    const resumeLabel = await browser.execute(
      (sel) =>
        document.querySelector(sel)?.getAttribute("aria-label") ?? "",
      resumeSelector,
    );
    const labelPage = Number((resumeLabel.match(/page (\d+)/) || [])[1] ?? 0);
    await browser.waitUntil(
      async () =>
        (await $('input[aria-label="Current page"]').getValue()) ===
        String(labelPage),
      {
        timeout: 15000,
        timeoutMsg: `resume did not land on the row page ${labelPage}`,
      },
    );

    if (PHASE === "dl1-create") {
      // ── Create a highlight through the public flow (drag + color click). ─
      await browser.waitUntil(
        async () =>
          browser.execute(() => {
            const spans = Array.from(
              document.querySelectorAll(".textLayer span"),
            );
            return spans.some((s) =>
              (s.textContent || "").includes("lectrice"),
            );
          }),
        { timeout: 30000, timeoutMsg: "paragraph never rendered" },
      );
      const geometry = await browser.execute(() => {
        const spans = Array.from(
          document.querySelectorAll(".textLayer span"),
        ).filter((s) => (s.textContent || "").includes("lectrice"));
        if (spans.length === 0) return null;
        const rects = spans.map((s) => s.getBoundingClientRect());
        return {
          left: Math.min(...rects.map((r) => r.left)),
          top: Math.min(...rects.map((r) => r.top)),
          width:
            Math.max(...rects.map((r) => r.right)) -
            Math.min(...rects.map((r) => r.left)),
          height:
            Math.max(...rects.map((r) => r.bottom)) -
            Math.min(...rects.map((r) => r.top)),
        };
      });
      expect(geometry).not.toBeNull();
      const y = geometry.top + geometry.height / 2;
      await browser.performActions([
        {
          type: "pointer",
          id: "mouse1",
          parameters: { pointerType: "mouse" },
          actions: [
            {
              type: "pointerMove",
              x: Math.round(geometry.left + 15),
              y: Math.round(y),
            },
            { type: "pointerDown", button: 0 },
            {
              type: "pointerMove",
              x: Math.round(geometry.left + geometry.width - 15),
              y: Math.round(y),
              duration: 200,
            },
            { type: "pointerUp", button: 0 },
          ],
        },
      ]);
      await browser.releaseActions();
      // The selection pipeline renders the PUBLIC color toolbar — observing
      // it proves the drag-select committed a pending selection (the actor's
      // pointer worked). Observe-only: the activation below is the PUBLIC
      // Ctrl+Shift+H keyboard shortcut, not a click on the toolbar.
      const toolbar = await $(
        '[role="toolbar"][aria-label="Highlight colors"]',
      );
      await toolbar.waitForExist({
        timeout: 10000,
        timeoutMsg: "highlight toolbar never appeared after selection",
      });

      // Prepare the close observer BEFORE the action — the import, the
      // regex and the window/process precondition captures must not run
      // inside the measured interval.
      const closeAndObserve = prepareCloseObserver();

      // ── THE TIMED PATH (harness contract): the activation is the PUBLIC
      //    Ctrl+Shift+H keyboard shortcut (the app's own highlight chord —
      //    HighlightCreationHandler commits the pending selection), sent as
      //    real WebDriver keys. Injected execute is never used to act —
      //    only to OBSERVE. tAction is stamped IMMEDIATELY BEFORE the key
      //    press. The success TOAST is NOT awaited (the product now emits it
      //    only after the persistence promise yields — round-4/5 review —
      //    and waiting would let persistence finish and destroy the
      //    fast-close race). The accepted-action marker is the OPTIMISTIC
      //    highlight overlay — the store add (addHighlight) is synchronous,
      //    so the public `Highlight: …` aria label renders within a frame,
      //    BEFORE persistence. The observation time is part of the measured
      //    action→close interval. The create IPC is deliberately held in
      //    flight for LECTRICE_E2E_HIGHLIGHT_CREATE_DELAY_MS=250 (Rust
      //    highlights_create, e2e-tts-fixture only) — so the close must land
      //    >=200ms (the window was held for the pending write) and <500ms
      //    (the debounce premise); closeAndObserve asserts both.
      const tAction = Date.now();
      await browser.keys(["Control", "Shift", "h"]);
      const observed = await browser.execute(async () => {
        const deadline = Date.now() + 300;
        while (Date.now() < deadline) {
          const el = document.querySelector('[aria-label*="Highlight: "]');
          if (el) {
            return {
              accepted: true,
              label: el.getAttribute("aria-label"),
              acceptedAt: Date.now(),
            };
          }
          await new Promise((r) => setTimeout(r, 25));
        }
        return { accepted: false };
      });
      if (!observed.accepted) {
        throw new Error(
          "no accepted highlight marker after Ctrl+Shift+H — the app did not acknowledge the action, so the close would test nothing",
        );
      }
      // ATTRIBUTION CEILING: the marker must appear while the create IPC is
      // DEFINITELY still delayed (250ms). A marker that only appeared after
      // the delay completed would make a >=200ms close false-green (the write
      // finished before the hold was even observable). The strict margin is
      // 150ms below the 250ms delay.
      const markerLatencyMs = observed.acceptedAt - tAction;
      console.log(
        "DIAG dl1-create:",
        JSON.stringify({ accepted: observed.label, markerLatencyMs }),
      );
      if (markerLatencyMs >= 150) {
        throw new Error(
          `marker appeared too late (${markerLatencyMs}ms >= 150ms) to prove the create IPC was still delayed — the 250ms delay may have completed before the observation, so the close would be false-green`,
        );
      }
      const timings = await closeAndObserve(tAction);
      console.log("DIAG dl1-close:", JSON.stringify(timings));
    } else if (PHASE === "dl1-verify") {
      // ── THE CLAIM: the highlight survived the immediate close. The
      //    product no longer claims success before persistence (the toast is
      //    honest, round-4/5) — the claim is that a highlight the user saw
      //    created (the optimistic overlay) survives the close. ────────────
      await browser.waitUntil(
        async () =>
          browser.execute(
            () => !!document.querySelector('[aria-label*="Highlight: "]'),
          ),
        {
          timeout: 15000,
          timeoutMsg:
            "highlight LOST after an immediate close — a highlight the user saw created did not survive (DL-1)",
        },
      );
      console.log(
        "DIAG dl1-verify:",
        JSON.stringify({ highlightSurvived: true }),
      );
    } else if (PHASE === "dl2-create") {
      // ── Turn a page (page 3) with the PUBLIC ArrowRight shortcut (the
      //    app's own next-page binding), then close IMMEDIATELY — inside the
      //    500 ms useAutoSave debounce. tAction is stamped BEFORE the key
      //    press; the accepted marker is the PUBLIC Current-page INPUT value
      //    = 3 (never __E2E_READ__ — the reviewer's oracle); the observation
      //    time is part of the measured action→close interval. Injected
      //    execute is observe-only.
      // Prepare the close observer BEFORE the action (imports, regex,
      // precondition captures — nothing of it may run inside the interval).
      const closeAndObserve = prepareCloseObserver();
      const tAction = Date.now();
      await browser.keys(["ArrowRight"]);
      const pageSeen = await browser.execute(async () => {
        const deadline = Date.now() + 300;
        while (Date.now() < deadline) {
          const input = document.querySelector(
            'input[aria-label="Current page"]',
          );
          if (input && input.value === "3") return true;
          await new Promise((r) => setTimeout(r, 25));
        }
        return false;
      });
      // The page advanced in the PUBLIC input after the key press — the
      // user's action landed. (A stale page here would be a product defect,
      // not a harness concern.)
      if (!pageSeen) {
        throw new Error("page did not advance to 3 after ArrowRight");
      }
      const timings = await closeAndObserve(tAction);
      console.log("DIAG dl2-close:", JSON.stringify(timings));
    } else {
      // ── THE CLAIM: the position survived — the reader must return to the
      //    page the user was on (3), not revert to the last flushed value. ──
      // At-launch probe: what does the row say BEFORE any resume action, and
      // what does the home's resume line show?
      const launchProbe = await browser.execute(async () => ({
        rowPage: await window.__E2E_READ__.ipcDocumentPage(),
        homeMeta:
          document.querySelector(".resume-line-meta")?.textContent ?? null,
        storePage: window.__E2E_READ__.currentPage(),
      }));
      console.log("DIAG dl2-verify-launch:", JSON.stringify(launchProbe));
      try {
        await browser.waitUntil(
          async () =>
            (await $('input[aria-label="Current page"]').getValue()) === "3",
          {
            timeout: 15000,
            timeoutMsg:
              "reading position LOST on close — reverted to the last flushed page (DL-2)",
          },
        );
      } catch (err) {
        console.log(
          "DIAG dl2-verify:",
          JSON.stringify({
            landedPage: await $('input[aria-label="Current page"]').getValue(),
          }),
        );
        throw err;
      }
      console.log(
        "DIAG dl2-verify:",
        JSON.stringify({ positionSurvived: true }),
      );
    }
  });
});
