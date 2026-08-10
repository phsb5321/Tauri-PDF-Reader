/**
 * Packaged reader-surface E2E (tauri-driver + WebdriverIO).
 *
 * The reader surface's central promise, gated in the packaged app:
 * READING POSITION SURVIVES A REAL APP RESTART — plus page navigation and
 * zoom through public controls actually move the RENDERED page.
 *
 * What critical-loop already covers (established, not duplicated): launch,
 * fixture load + text render, real karaoke loop advance, and a menu-action
 * advancing the STORE's page. It does NOT cover: useAutoSave persistence
 * across a restart, the rendered (text-layer) page changing on navigation,
 * the page input, or zoom — all of which this lane does.
 *
 * Two phases, one hermetic profile:
 *   READER_PHASE=navigate — resume the fixture (page 2), navigate with the
 *     public Next button (2→3), then the public page input (3→4), asserting
 *     the RENDERED text layer follows each time; zoom in through the public
 *     control and assert the percentage display moves. useAutoSave writes
 *     the page — the runner then verifies the library row in the profile DB.
 *   READER_PHASE=verify — the app RELAUNCHES on the same profile. The home's
 *     resume line must already show "Page 4 of 5 · 80%" (the persisted page
 *     visible BEFORE any resume), and resuming must land on the rendered
 *     page 4. This is the same shape as the two defects already caught
 *     (#100 highlights, #103 sessions): a persisted value that may never
 *     make it back to the screen.
 *
 * Actor contract: public controls only (Resume button, Next button, page
 * input, zoom button), dispatched with element.click() after
 * waitForClickable() — the vimeflow#65 pin. `window.__E2E_READ__` is
 * read-only observer instrumentation.
 *
 * Run with:  E2E_SPEC=./e2e/reader-journey.e2e.mjs  READER_PHASE=navigate|verify
 * against a binary built `--features e2e-tts-fixture` and a frontend built
 * `VITE_E2E_NATIVE=true` — see e2e/run-reader-journey.sh.
 */

/* global browser, $, expect */

const PHASE = process.env.READER_PHASE || "navigate";

/** The claim being gated: the page the reader was on when the app closed. */
const SAVED_PAGE = "4";

/**
 * The fixture's per-page text marker. gen-e2e-fixtures.mjs writes the
 * resume-target page (2) as "…page two…" (the long narration paragraph);
 * every other page is "…page N…".
 */
const pageMarker = (n) =>
  n === 2 ? "fixture page two" : `fixture page ${n}`;

async function renderedPageShows(n) {
  return browser.execute(
    (marker) =>
      Array.from(
        document.querySelectorAll(".textLayer span, [class*='textLayer'] span"),
      ).some((s) => (s.textContent || "").includes(marker)),
    pageMarker(n),
  );
}

describe("Packaged reader journey (position survives restart; nav + zoom render)", () => {
  it(`${PHASE}: the rendered reader follows navigation and survives a restart at the saved page`, async () => {
    await browser.waitUntil(
      async () =>
        browser.execute(
          () => !!(window.__E2E_READ__ && window.__E2E_READ__.ready),
        ),
      { timeout: 40000, timeoutMsg: "bootstrap never became ready" },
    );
    await browser.setWindowSize(1200, 800);

    if (PHASE === "navigate") {
      // ── Resume the seeded fixture (public Resume button on the home). ────
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

      // Lands on the seeded page (2) AND the text layer renders it.
      await browser.waitUntil(
        async () =>
          (await $('input[aria-label="Current page"]').getValue()) === "2",
        { timeout: 15000, timeoutMsg: "resume did not land on page 2" },
      );
      await browser.waitUntil(
        async () => renderedPageShows(2),
        { timeout: 30000, timeoutMsg: "page 2 never rendered in the text layer" },
      );
      // ── 1. Public Next button: 2 → 3, rendered, not just store. ──────────
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
      await browser.waitUntil(
        async () => renderedPageShows(3),
        { timeout: 15000, timeoutMsg: "page 3 never rendered after Next" },
      );

      // ── 2. Public page input: 3 → 4, via the keyboard (focus, select-all,
      //    type, Enter). NOT setValue: on WebKitGTK the driver's clear can
      //    silently fail and the typed digit APPENDS to the existing value
      //    ("3" + "4" = "34" → clamped to 5) — a real user's Ctrl+A, type,
      //    Enter is the honest public path and is unambiguous. ─────────────
      const pageInput = await $('input[aria-label="Current page"]');
      await pageInput.click();
      await browser.keys(["Control", "a"]);
      await browser.keys([SAVED_PAGE]);
      await browser.keys(["Enter"]);
      await browser.waitUntil(
        async () =>
          (await $('input[aria-label="Current page"]').getValue()) === SAVED_PAGE,
        { timeout: 10000, timeoutMsg: "page input did not jump to page 4" },
      );
      await browser.waitUntil(
        async () => renderedPageShows(4),
        { timeout: 15000, timeoutMsg: "page 4 never rendered after input jump" },
      );

      // ── 3. Zoom through the public control: percentage display moves. ────
      const zoomBefore = await $("span.zoom-percentage").getText();
      const zoomIn = await $('button[aria-label="Zoom in"]');
      await zoomIn.waitForClickable({ timeout: 10000 });
      await browser.execute(() =>
        document.querySelector('button[aria-label="Zoom in"]')?.click(),
      );
      await browser.waitUntil(
        async () => (await $("span.zoom-percentage").getText()) !== zoomBefore,
        { timeout: 10000, timeoutMsg: "zoom percentage never changed after Zoom in" },
      );

      // Let useAutoSave's debounce land (the runner then verifies the row).
      await browser.pause(1500);
    } else {
      // ── VERIFY phase: the app relaunched on the SAME profile. The home's
      //    resume line must ALREADY show the persisted page, before any
      //    resume action — the value made it back to the screen. ───────────
      const meta = await $(".resume-line-meta");
      try {
        await meta.waitForExist({ timeout: 15000 });
      } catch (err) {
        console.log(
          "DIAG reader-verify-home:",
          JSON.stringify(
            await browser.execute(() => ({
              homeText: document.querySelector(".resume-section")?.textContent ?? null,
              gridText: document.querySelector(".library-body, .library-grid, [class*='library']")?.textContent?.slice(0, 200) ?? null,
              logs: window.__E2E_READ__.logs().slice(-40),
            })),
          ),
        );
        throw err;
      }
      const metaText = await meta.getText();
      expect(metaText).toContain(`Page ${SAVED_PAGE} of 5`);
      expect(metaText).toContain("80%");

      // Resume lands on the saved page AND renders it.
      await browser.execute(() =>
        document
          .querySelector('button[aria-label^="Resume E2E Resume Fixture A, page"]')
          ?.click(),
      );
      await browser.waitUntil(
        async () =>
          (await $('input[aria-label="Current page"]').getValue()) === SAVED_PAGE,
        { timeout: 15000, timeoutMsg: "resume did not land on the saved page 4" },
      );
      await browser.waitUntil(
        async () => renderedPageShows(4),
        { timeout: 30000, timeoutMsg: "saved page 4 never rendered after restart" },
      );

      console.log(
        "DIAG reader-verify:",
        JSON.stringify({
          phase: "verify",
          homeResumeLine: metaText,
          landedPage: await $('input[aria-label="Current page"]').getValue(),
          renderedPage4: true,
          claim: "reading position survives a restart and renders",
        }),
      );
    }
  });
});
