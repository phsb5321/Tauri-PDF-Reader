/**
 * Packaged close-journey E2E (tauri-driver + WebdriverIO).
 *
 * The close-and-relaunch oracle for two data-loss findings (DL-1, DL-2):
 * nothing in src-tauri handles on_window_event / CloseRequested, so pending
 * debounced writes are never flushed when the window goes away.
 *
 *   DL-1 — a highlight created just before quitting is lost AFTER the app
 *          said it saved (useHighlightPersistence debounceMs = 500; the
 *          success toast fires unconditionally).
 *   DL-2 — reading position is lost on close (useAutoSave scheduleSave(500)
 *          on page change; checkUnsavedProgress has zero callers).
 *
 * Four phases, one hermetic profile, fresh app process per phase:
 *   CLOSE_PHASE=dl1-create  resume → drag-select → Yellow → capture the
 *                           success toast → CLOSE IMMEDIATELY (inside the
 *                           500 ms debounce).
 *   CLOSE_PHASE=dl1-verify  relaunch → resume → the highlight must STILL be
 *                           there (the app claimed it saved). RED on main.
 *   CLOSE_PHASE=dl2-create  resume (page 2) → Next (page 3) → CLOSE
 *                           IMMEDIATELY (inside the 500 ms debounce).
 *   CLOSE_PHASE=dl2-verify  relaunch → resume → the page must be 3 (where
 *                           the user was). RED on main.
 *
 * THE CLOSE IS A GENUINE WINDOW CLOSE, not a process kill: the actor closes
 * the window through the X server (xdotool windowclose — the WM_DELETE_WINDOW
 * client message a window manager sends on the close button). A SIGKILL
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

import { spawn } from "node:child_process";

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
 * the X server (xdotool windowclose). Runs under the lane's DISPLAY.
 *
 * Deliberately a DETACHED spawn, not an execSync: the close request must
 * reach the window as fast as physically possible after the actor's last
 * action (the data-loss race is a 500 ms debounce vs the app's teardown
 * latency — every ms counts). The spec makes no further commands after it,
 * so the session death is absorbed by teardown.
 */
function closeWindow() {
  spawn("xdotool", ["search", "--name", "Lectrice", "windowclose"], {
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
async function closeAndObserve(tAction) {
  const { execFileSync } = await import("node:child_process");
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
  const appAlive = () => alive("pgrep", ["-f", appPattern]);

  const windowSeenBefore = windowAlive();
  const appSeenBefore = appAlive();
  closeWindow();

  let windowClosedAt = null;
  let tDeath = null;
  for (let i = 0; i < 200; i++) {
    if (windowClosedAt === null && windowSeenBefore && !windowAlive()) {
      windowClosedAt = Date.now();
    }
    if (!appAlive()) {
      tDeath = Date.now();
      // The app can die between this iteration's window probe and its app
      // probe. Without this last look the close would be recorded as "never
      // happened" and reported as a false RED blaming the wrong thing.
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
  const fs = await import("node:fs");
  fs.writeFileSync(TIMING_PATH, record);

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
      `window NEVER CLOSED after xdotool windowclose — the close never reached the app, so this phase proves nothing about CloseRequested. ${record}`,
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
  return timings;
}

describe("Packaged close journey (DL-1 highlight loss, DL-2 position loss)", () => {
  it(`${PHASE}: ${PHASE.includes("dl1") ? "highlight survives an immediate close" : "reading position survives an immediate close"}`, async () => {
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

    // Every phase starts the same: resume the seeded fixture, landing on the
    // row's ACTUAL page (the seed default is 2, but after dl2-create the row
    // is 3 — a hardcoded 2 would fail the post-fix world).
    const rowPage =
      (await browser.execute(async () =>
        window.__E2E_READ__.ipcDocumentPage(),
      )) ?? 2;
    const resume = await $(
      'button[aria-label^="Resume E2E Resume Fixture A, page"]',
    );
    await resume.waitForExist({ timeout: 15000 });
    await resume.waitForClickable({ timeout: 15000 });
    await browser.execute(() =>
      document
        .querySelector('button[aria-label^="Resume E2E Resume Fixture A, page"]')
        ?.click(),
    );
    await browser.waitUntil(
      async () =>
        (await $('input[aria-label="Current page"]').getValue()) ===
        String(rowPage),
      {
        timeout: 15000,
        timeoutMsg: `resume did not land on the row page ${rowPage}`,
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
      const yellow = await $('button[aria-label="Highlight with Yellow"]');
      await yellow.waitForClickable({ timeout: 10000 });

      // ── TIMING INSTRUMENTATION (the decisive number for the DL-1 re-check):
      //    the interval between the Yellow click (the debounce enqueue) and
      //    the window close. Written to a file the runner can join with the
      //    app-death timestamp to also get close→death (the teardown latency)
      //    and click→death (whether the 500 ms timer could have fired).
      const tClick = Date.now();
      await browser.execute(() =>
        document
          .querySelector('button[aria-label="Highlight with Yellow"]')
          ?.click(),
      );

      // The app claims success IMMEDIATELY (the toast fires unconditionally,
      // before the debounced persist). Capture that claim, then close FAST —
      // inside the 500 ms debounce window. The close is the final statement.
      const toastText = await browser.execute(() => {
        const t = Array.from(
          document.querySelectorAll("[class*='toast'], [role='status']"),
        )
          .map((el) => el.textContent)
          .find((t) => t && /highlight/i.test(t));
        return t ?? null;
      });
      const tToastDone = Date.now();
      // DL-1's premise is that the app SAID it saved. If the toast never
      // appeared, the premise is absent and a later green would be vacuous.
      if (!toastText) {
        throw new Error(
          "no success toast after the Yellow click — DL-1's premise (the app claimed it saved) is unproven, so the close would test nothing",
        );
      }
      console.log(
        "DIAG dl1-create:",
        JSON.stringify({ toastText, clickToToastMs: tToastDone - tClick }),
      );
      const timings = await closeAndObserve(tClick);
      console.log("DIAG dl1-close:", JSON.stringify(timings));
    } else if (PHASE === "dl1-verify") {
      // ── THE CLAIM: the highlight survived — the app said it saved. ───────
      await browser.waitUntil(
        async () =>
          browser.execute(() =>
            !!document.querySelector('[aria-label*="Highlight: "]'),
          ),
        {
          timeout: 15000,
          timeoutMsg:
            "highlight LOST after an immediate close — the app claimed success before the debounced write flushed (DL-1)",
        },
      );
      console.log(
        "DIAG dl1-verify:",
        JSON.stringify({ highlightSurvived: true }),
      );
    } else if (PHASE === "dl2-create") {
      // ── Turn a page (page 3), then close IMMEDIATELY — inside the 500 ms
      //    useAutoSave debounce. The close is the final statement. ─────────
      const next = await $('button[title="Next page (Right Arrow)"]');
      await next.waitForClickable({ timeout: 10000 });
      // The debounce is enqueued by the page change, so the interval that
      // matters starts HERE — not after the confirmation and probe below,
      // which would silently discard part of the window being raced.
      const tPageTurn = Date.now();
      await browser.execute(() =>
        document.querySelector('button[title="Next page (Right Arrow)"]')?.click(),
      );
      await browser.waitUntil(
        async () =>
          (await $('input[aria-label="Current page"]').getValue()) === "3",
        { timeout: 10000, timeoutMsg: "Next did not move to page 3" },
      );
      // Single fast probe for the record (the close-flush makes the debounce
      // moot, but the pre-close row state is evidence).
      const rowAtClose = await browser.execute(async () => ({
        rowPage: await window.__E2E_READ__.ipcDocumentPage(),
      }));
      console.log("DIAG dl2-create:", JSON.stringify(rowAtClose));
      const timings = await closeAndObserve(tPageTurn);
      console.log("DIAG dl2-close:", JSON.stringify(timings));
    } else {
      // ── THE CLAIM: the position survived — the reader must return to the
      //    page the user was on (3), not revert to the last flushed value. ──
      // At-launch probe: what does the row say BEFORE any resume action, and
      // what does the home's resume line show?
      const launchProbe = await browser.execute(async () => ({
        rowPage: await window.__E2E_READ__.ipcDocumentPage(),
        homeMeta: document.querySelector(".resume-line-meta")?.textContent ?? null,
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
