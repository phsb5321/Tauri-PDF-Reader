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
      const tClose = Date.now();
      console.log("DIAG dl1-create:", JSON.stringify({ toastText }));
      closeWindow();

      // ── Node-side death poll: the WebDriver session is dead with the
      //    window, but plain Node still runs. Poll the app process AND the X
      //    window to get close→death (the teardown latency) and click→death
      //    (>= 500 ms names the debounce timer as the persistence mechanism).
      //    Also answers the prior question: does the WINDOW even close?
      const { execSync } = await import("node:child_process");
      const appPattern =
        "^" + process.cwd() + "/src-tauri/target/debug/tauri-pdf-reader";
      let tDeath = null;
      let windowClosedAt = null;
      let windowStillThere = null;
      for (let i = 0; i < 200; i++) {
        let appAlive = true;
        try {
          execSync(`pgrep -f '${appPattern}'`, { stdio: "ignore" });
        } catch {
          appAlive = false;
        }
        let winAlive = true;
        try {
          execSync("xdotool search --name Lectrice", { stdio: "ignore" });
        } catch {
          winAlive = false;
        }
        if (windowClosedAt === null && !winAlive) {
          windowClosedAt = Date.now();
        }
        if (!appAlive) {
          tDeath = Date.now();
          break;
        }
        if (i === 199) windowStillThere = winAlive;
        await new Promise((r) => setTimeout(r, 50));
      }
      const fs = await import("node:fs");
      fs.writeFileSync(
        "/tmp/lectrice-dl1-timing.json",
        JSON.stringify({
          tClick,
          tToastDone,
          tClose,
          tDeath,
          windowClosedAt,
          windowStillThere,
          clickToToastMs: tToastDone - tClick,
          clickToCloseMs: tClose - tClick,
          closeToDeathMs: tDeath ? tDeath - tClose : null,
          clickToDeathMs: tDeath ? tDeath - tClick : null,
          closeToWindowCloseMs: windowClosedAt ? windowClosedAt - tClose : null,
        }),
      );
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
      closeWindow();
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
