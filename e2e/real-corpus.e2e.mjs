/**
 * Real-corpus E2E (tauri-driver + WebdriverIO) — the post-merge/manual soak
 * tier of the packaged user gate.
 *
 * PR-fast (critical-loop) and the fixture matrix prove DETERMINISTIC paths.
 * This lane runs the PACKAGED app over REAL books from
 * LECTRICE_REAL_PDF_CORPUS: multi-hundred-page PDFs with real fonts and real
 * render cost — the class no generated fixture exercises. It answers one
 * question per book: does a real book open, render, navigate, survive a
 * genuine fast close, and resume at the right page?
 *
 * Three phases per book, each a fresh app process on the SAME hermetic
 * profile (the observer stages the book once):
 *
 *   E2E_CORPUS_PHASE=open     — toolbar Open on the staged real book; the
 *                               reader must show it (real pdf.js parse, real
 *                               fs read through the scoped plugin-fs path);
 *                               next ×2 → page 3; DIAG records title, real
 *                               totalPages (>10 — a REAL book, not a 3-page
 *                               fixture) and currentPage.
 *   E2E_CORPUS_PHASE=close    — relaunch → resume → assert the row is on
 *                               page 3 → GENUINE WM_DELETE_WINDOW close
 *                               (xdotool windowclose) inside the 500 ms
 *                               debounce → close timing asserted (the
 *                               close-journey idiom, DEBOUNCE_MS = the
 *                               useAutoSave.ts:90 argument).
 *   E2E_CORPUS_PHASE=verify   — relaunch → resume → the library row must be
 *                               page 3 and reopening the book must RENDER
 *                               page 3. This is the DL-2 class on a REAL
 *                               book.
 *
 * Copyright boundary (never stores copyrighted PDFs/artifacts): the observer
 * stages a TRANSIENT copy of each book inside the hermetic profile's
 * applocaldata (the only in-fs-scope read path); the lane never embeds the
 * book into a build, never uploads it, and the profile is deleted by the
 * runner's trap. Outputs are per-phase logs and a machine-readable summary —
 * no PDF bytes, no derived renders.
 */

/* global browser, $, expect */

import { spawn } from "node:child_process";

const PHASE = process.env.E2E_CORPUS_PHASE || "open";
const BOOK = process.env.E2E_CORPUS_BOOK || "";

if (!BOOK) {
  throw new Error(
    "E2E_CORPUS_BOOK must name the staged real book (absolute path inside the hermetic profile)",
  );
}

const DEBOUNCE_MS = 500;

/**
 * The actor closes the window the way a user does: WM_DELETE_WINDOW through
 * the X server. Detached spawn — the close must reach the window as fast as
 * possible after the page-change action (the race is a 500 ms debounce vs
 * teardown latency). Idiom derived from close-journey.e2e.mjs.
 */
function closeWindow() {
  spawn("xdotool", ["search", "--name", "Lectrice", "windowclose"], {
    detached: true,
    stdio: "ignore",
  }).unref();
}

/**
 * Close + observe — the window must be SEEN alive first, then SEEN gone;
 * timing is the only sound close instant and an UPPER bound (under-states
 * fork/exec + X-tree walk, the safe direction for an inside-the-debounce
 * claim). A silent xdotool failure or a renamed window fails the phase
 * instead of ending it green. Same idiom as close-journey.e2e.mjs.
 */
async function closeAndObserve(tAction) {
  const { execFileSync } = await import("node:child_process");
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
      if (windowClosedAt === null && windowSeenBefore && !windowAlive()) {
        windowClosedAt = Date.now();
      }
      break;
    }
    await new Promise((r) => setTimeout(r, 50));
  }

  const timings = {
    phase: PHASE,
    book: BOOK,
    tAction,
    windowSeenBefore,
    appSeenBefore,
    windowClosedAt,
    tDeath,
    actionToWindowCloseMs: windowClosedAt ? windowClosedAt - tAction : null,
    actionToDeathMs: tDeath ? tDeath - tAction : null,
  };
  // Published under the hermetic profile (XDG_DATA_HOME), never a shared
  // /tmp path — the same collision guard as close-journey.
  if (process.env.XDG_DATA_HOME) {
    const { writeFileSync } = await import("node:fs");
    const p = `${process.env.XDG_DATA_HOME}/corpus-close-timing-${PHASE}.json`;
    writeFileSync(p, JSON.stringify(timings));
  }

  expect(windowSeenBefore).toBe(true);
  expect(windowClosedAt).not.toBe(null);
  if (timings.actionToWindowCloseMs !== null) {
    expect(timings.actionToWindowCloseMs).toBeLessThan(DEBOUNCE_MS);
  }
  return timings;
}

async function bridgeReady() {
  await browser.waitUntil(
    async () =>
      browser.execute(() => !!(window.__E2E__ && window.__E2E__.ready)),
    { timeout: 30000, timeoutMsg: "E2E bridge never became ready" },
  );
}

describe(`Real-corpus (${PHASE})`, () => {
  if (PHASE === "open") {
    it("opens the REAL book, renders it, and navigates to page 3", async () => {
      await bridgeReady();
      await browser.execute(
        (p) => window.__E2E__.installCorpusBook(p),
        BOOK,
      );
      // Toolbar Open (the only visible open path on packaged Linux).
      await browser.execute(() =>
        document.querySelector("button.open-button")?.click(),
      );
      // The reader must show the real book: a REAL totalPages (> 10 — a
      // generated fixture is 3 pages; the five-book DE corpus is 300+).
      await browser.waitUntil(
        async () =>
          browser.execute(() => {
            const s = window.__E2E__.getState();
            return s.hasDocument && s.totalPages > 10;
          }),
        {
          timeout: 60000,
          timeoutMsg: "real book never rendered (totalPages <= 10)",
        },
      );
      const opened = await browser.execute(() => window.__E2E__.getState());
      expect(opened.totalPages).toBeGreaterThan(10);
      // Navigate: next → 2 → 3, then assert the store's currentPage.
      await browser.execute(() => window.__E2E__.emitMenu("next-page"));
      await browser.execute(() => window.__E2E__.emitMenu("next-page"));
      await browser.waitUntil(
        async () =>
          browser.execute(() => window.__E2E__.getState().currentPage) === 3,
        { timeout: 15000, timeoutMsg: "page did not advance to 3" },
      );
      const nav = await browser.execute(() => window.__E2E__.getState());
      expect(nav.currentPage).toBe(3);
      console.log(
        "DIAG corpus-open:",
        JSON.stringify({ book: BOOK, totalPages: opened.totalPages, currentPage: nav.currentPage }),
      );
    });
  }

  if (PHASE === "close") {
    it("resumes the real book at page 3 and survives a genuine fast close", async () => {
      await bridgeReady();
      // Resume the library row (page 3 from the open phase).
      await browser.waitUntil(
        async () =>
          browser.execute(() => {
            const el = document.querySelector('[role="link"], .resume-line');
            return !!el;
          }),
        { timeout: 15000, timeoutMsg: "no resume affordance after relaunch" },
      );
      // The resume row's primary action is the read/play button; click it
      // (public control only).
      await browser.execute(() => {
        const row = document.querySelector(
          '.resume-line button, .resume-line [role="button"]',
        );
        row?.click();
      });
      await browser.waitUntil(
        async () =>
          browser.execute(() => window.__E2E__.getState().currentPage) === 3,
        { timeout: 30000, timeoutMsg: "resume did not land on page 3" },
      );
      // The write to protect: another page change, then a GENUINE close
      // inside the debounce.
      await browser.execute(() => window.__E2E__.emitMenu("next-page"));
      const tAction = Date.now();
      await closeAndObserve(tAction);
    });
  }

  if (PHASE === "verify") {
    it("the library row and the reopened book are on page 3", async () => {
      await bridgeReady();
      await browser.waitUntil(
        async () =>
          browser.execute(() => {
            const el = document.querySelector(".resume-line, .document-row");
            return !!el;
          }),
        { timeout: 15000, timeoutMsg: "no library row after relaunch" },
      );
      const row = await browser.execute(() => {
        const el = document.querySelector(".resume-line, .document-row");
        return el ? el.textContent ?? null : null;
      });
      // The row must reflect page 3 of the real book (the resume line
      // formats "Page 3 of N").
      expect(row ?? "").toContain("Page 3");
      // Reopen from the row and confirm the RENDERED page is 3.
      await browser.execute(() => {
        const el = document.querySelector(
          '.resume-line button, .resume-line [role="button"], .document-row button',
        );
        el?.click();
      });
      await browser.waitUntil(
        async () =>
          browser.execute(() => window.__E2E__.getState().currentPage) === 3,
        { timeout: 30000, timeoutMsg: "reopened book did not render page 3" },
      );
      const state = await browser.execute(() => window.__E2E__.getState());
      console.log(
        "DIAG corpus-verify:",
        JSON.stringify({ book: BOOK, row: row ?? null, currentPage: state.currentPage }),
      );
      expect(state.currentPage).toBe(3);
    });
  }
});
